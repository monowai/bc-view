import React, { useState, useMemo, useCallback } from "react"
import { useTranslation } from "next-i18next"
import useSWR from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import {
  parseShorthandAmount,
  hasShorthandSuffix,
} from "@utils/formatting/amountParser"
import { ModelDto, ExecutionDto, ExecutionItemDto, PlanDto } from "types/rebalance"
import { Broker } from "types/beancounter"

interface InvestCashDialogProps {
  modalOpen: boolean
  portfolioId: string
  onClose: () => void
  onSuccess: () => void
}

// Helper to strip market prefix from asset code (e.g., "US:VOO" -> "VOO")
const formatAssetCode = (code?: string): string => {
  if (!code) return ""
  const colonIndex = code.indexOf(":")
  return colonIndex >= 0 ? code.substring(colonIndex + 1) : code
}

// Track user edits to qty/price
interface ItemEdits {
  [assetId: string]: { quantity?: number; price?: number }
}

const InvestCashDialog: React.FC<InvestCashDialogProps> = ({
  modalOpen,
  portfolioId,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation("common")

  // Step state
  const [step, setStep] = useState<"input" | "preview">("input")

  // Input state
  const [amount, setAmount] = useState<string>("")
  const [selectedModel, setSelectedModel] = useState<ModelDto | null>(null)

  // Execution state - backend returns complete payload
  const [execution, setExecution] = useState<ExecutionDto | null>(null)
  const [itemEdits, setItemEdits] = useState<ItemEdits>({})
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | undefined>(
    undefined,
  )
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch models
  const { data: modelsData, isLoading: loadingModels } = useSWR(
    modalOpen ? "/api/rebalance/models" : null,
    simpleFetcher("/api/rebalance/models"),
  )

  // Fetch brokers
  const { data: brokersData } = useSWR(
    modalOpen ? "/api/brokers" : null,
    simpleFetcher("/api/brokers"),
  )
  const brokers: Broker[] = brokersData?.data || []

  const models: ModelDto[] = modelsData?.data || []
  const modelsWithApprovedPlans = models.filter(
    (m) => m.currentPlanId && m.currentPlanVersion,
  )

  // Fetch plan details when a model is selected
  const { data: planData, isLoading: loadingPlan } = useSWR<{ data: PlanDto }>(
    selectedModel?.currentPlanId
      ? `/api/rebalance/models/${selectedModel.id}/plans/${selectedModel.currentPlanId}`
      : null,
    simpleFetcher(
      `/api/rebalance/models/${selectedModel?.id}/plans/${selectedModel?.currentPlanId}`,
    ),
  )
  const planAssets = planData?.data?.assets || []
  const cashWeight = planData?.data?.cashWeight ?? 0

  // Get buy items from execution (non-cash, positive quantity)
  const buyItems = useMemo(() => {
    if (!execution) return []
    return execution.items.filter(
      (item) => !item.isCash && item.deltaQuantity > 0,
    )
  }, [execution])

  // Get effective qty/price for an item (user edit or original)
  const getItemValues = useCallback(
    (item: ExecutionItemDto): { qty: number; price: number; value: number } => {
      const edits = itemEdits[item.assetId] || {}
      const qty = edits.quantity ?? item.deltaQuantity
      const price = edits.price ?? item.snapshotPrice ?? 0
      return { qty, price, value: qty * price }
    },
    [itemEdits],
  )

  // Calculate totals
  const { totalSpending, portfolioCash, cashAfter } = useMemo(() => {
    const cash = execution?.snapshotCashValue ?? 0
    const spending = buyItems.reduce(
      (sum, item) => sum + getItemValues(item).value,
      0,
    )
    return {
      totalSpending: spending,
      portfolioCash: cash,
      cashAfter: cash - spending,
    }
  }, [execution?.snapshotCashValue, buyItems, getItemValues])

  // Handle quantity change
  const handleQuantityChange = (assetId: string, newQty: number): void => {
    setItemEdits((prev) => ({
      ...prev,
      [assetId]: { ...prev[assetId], quantity: Math.max(0, newQty) },
    }))
  }

  // Handle price change
  const handlePriceChange = (assetId: string, newPrice: number): void => {
    setItemEdits((prev) => ({
      ...prev,
      [assetId]: { ...prev[assetId], price: Math.max(0, newPrice) },
    }))
  }

  // Create execution (Step 1 -> Step 2)
  const handlePreview = async (): Promise<void> => {
    if (!selectedModel?.currentPlanId || !amount) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/rebalance/executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedModel.currentPlanId,
          portfolioIds: [portfolioId],
          mode: "INVEST_CASH",
          investmentAmount: parseShorthandAmount(amount),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.message || `Failed to create execution`)
        return
      }

      const data = await response.json()
      setExecution(data.data)
      setItemEdits({}) // Clear any previous edits
      setStep("preview")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create preview")
    } finally {
      setLoading(false)
    }
  }

  // Commit execution with any user edits
  const handleCommit = async (): Promise<void> => {
    if (!execution) return

    setCommitting(true)
    setError(null)

    try {
      // Only send updates if user made edits
      if (Object.keys(itemEdits).length > 0) {
        const itemUpdates = buyItems
          .filter((item) => itemEdits[item.assetId])
          .map((item) => ({
            assetId: item.assetId,
            quantity: itemEdits[item.assetId]?.quantity,
            price: itemEdits[item.assetId]?.price,
          }))

        const updateResponse = await fetch(
          `/api/rebalance/executions/${execution.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemUpdates }),
          },
        )

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json().catch(() => ({}))
          setError(errorData.message || `Failed to update execution`)
          return
        }
      }

      // Commit to create transactions
      const response = await fetch(
        `/api/rebalance/executions/${execution.id}/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId: portfolioId,
            transactionStatus: "PROPOSED",
            brokerId: selectedBrokerId,
          }),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.message || `Failed to commit transactions`)
        return
      }

      onSuccess()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to commit")
    } finally {
      setCommitting(false)
    }
  }

  // Reset and close
  const handleClose = (): void => {
    setStep("input")
    setAmount("")
    setSelectedModel(null)
    setExecution(null)
    setItemEdits({})
    setSelectedBrokerId(undefined)
    setError(null)
    onClose()
  }

  // Go back to input step
  const handleBack = (): void => {
    setStep("input")
    setExecution(null)
    setItemEdits({})
    setError(null)
  }

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  if (!modalOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={handleClose}
      ></div>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-auto p-6 z-50 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {step === "input"
              ? t("rebalance.investCash.title", "Invest Cash")
              : t("rebalance.investCash.preview", "Preview Transactions")}
          </h2>
          <button
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            onClick={handleClose}
          >
            &times;
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 mb-4 text-sm">
            {error}
          </div>
        )}

        {step === "input" ? (
          <>
            {/* Step 1: Amount + Model Selection */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("rebalance.investCash.amount", "Investment Amount")}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10k"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t(
                    "rebalance.investCash.amountHint",
                    "Use h=100, k=1000, m=1000000 (e.g., 4k = 4,000)",
                  )}
                  {amount && hasShorthandSuffix(amount) && (
                    <span className="ml-2 text-blue-600 font-medium">
                      = {parseShorthandAmount(amount).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("rebalance.investCash.selectModel", "Select Model")}
                </label>

                {loadingModels ? (
                  <div className="py-4 text-center text-gray-500">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    {t("loading", "Loading...")}
                  </div>
                ) : modelsWithApprovedPlans.length === 0 ? (
                  <div className="py-4 text-center text-gray-500">
                    <i className="fas fa-folder-open text-2xl mb-2"></i>
                    <p className="text-sm">
                      {t(
                        "rebalance.investCash.noModels",
                        "No approved models found. Create a model and approve a plan first.",
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {modelsWithApprovedPlans.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModel(model)}
                        className={`w-full text-left p-3 border rounded-lg transition-colors ${
                          selectedModel?.id === model.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="font-medium text-gray-900">
                          {model.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {model.baseCurrency}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            <i className="fas fa-check-circle mr-1"></i>v
                            {model.currentPlanVersion}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Plan Preview - show when a model is selected */}
                {selectedModel && (
                  <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700">
                        <i className="fas fa-chart-pie mr-2 text-gray-400"></i>
                        {t(
                          "rebalance.investCash.planAssets",
                          "Plan Allocations",
                        )}
                      </h4>
                    </div>
                    {loadingPlan ? (
                      <div className="py-4 text-center text-gray-500 text-sm">
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        {t("loading", "Loading...")}
                      </div>
                    ) : planAssets.length === 0 ? (
                      <div className="py-4 text-center text-gray-500 text-sm">
                        {t(
                          "rebalance.investCash.noAssets",
                          "No assets in plan",
                        )}
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                {t("asset", "Asset")}
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">
                                {t("weight", "Weight")}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {planAssets
                              .sort((a, b) => b.weight - a.weight)
                              .map((asset) => (
                                <tr key={asset.id}>
                                  <td
                                    className="px-3 py-2"
                                    title={asset.rationale || undefined}
                                  >
                                    <div className="font-medium text-gray-900 text-sm">
                                      {formatAssetCode(asset.assetCode) ||
                                        asset.assetId}
                                      {asset.rationale && (
                                        <i className="fas fa-info-circle ml-1 text-gray-400 text-xs"></i>
                                      )}
                                    </div>
                                    {asset.assetName && (
                                      <div className="text-xs text-gray-500 truncate max-w-48">
                                        {asset.assetName}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right text-sm text-gray-700">
                                    {(asset.weight * 100).toFixed(1)}%
                                  </td>
                                </tr>
                              ))}
                            {cashWeight > 0 && (
                              <tr className="bg-blue-50">
                                <td className="px-3 py-2">
                                  <div className="font-medium text-blue-700 text-sm">
                                    <i className="fas fa-coins mr-1"></i>
                                    {t("cash", "Cash")}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right text-sm text-blue-700">
                                  {(cashWeight * 100).toFixed(1)}%
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 1 footer */}
            <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                {t("cancel", "Cancel")}
              </button>
              <button
                onClick={handlePreview}
                disabled={
                  !selectedModel ||
                  !amount ||
                  parseShorthandAmount(amount) <= 0 ||
                  loading
                }
                className={`px-4 py-2 rounded text-white transition-colors ${
                  selectedModel &&
                  amount &&
                  parseShorthandAmount(amount) > 0 &&
                  !loading
                    ? "bg-blue-500 hover:bg-blue-600"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    {t("loading", "Loading...")}
                  </span>
                ) : (
                  t("rebalance.investCash.preview", "Preview")
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2: Preview - backend provides complete data, UI calculates qty × price */}
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("asset", "Asset")}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">
                        {t("quantity", "Qty")}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">
                        {t("price", "Price")}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">
                        {t("value", "Value")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {buyItems.map((item) => {
                      const { qty, price, value } = getItemValues(item)
                      const displayCode = formatAssetCode(item.assetCode)
                      return (
                        <tr key={item.assetId} className="bg-green-50">
                          <td
                            className="px-3 py-2"
                            title={item.rationale || undefined}
                          >
                            <div className="font-medium text-gray-900 text-sm cursor-help">
                              {displayCode || item.assetId}
                              {item.rationale && (
                                <i className="fas fa-info-circle ml-1 text-gray-400 text-xs"></i>
                              )}
                            </div>
                            {item.assetName && (
                              <div className="text-xs text-gray-500 truncate max-w-45">
                                {item.assetName}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={qty}
                              onChange={(e) =>
                                handleQuantityChange(
                                  item.assetId,
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              className="w-full px-2 py-1 text-right text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={price.toFixed(2)}
                              onChange={(e) =>
                                handlePriceChange(
                                  item.assetId,
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full px-2 py-1 text-right text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-green-700 font-medium text-sm">
                            {formatCurrency(value)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary panel */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">
                      {t(
                        "rebalance.investCash.portfolioCash",
                        "Portfolio Cash",
                      )}
                    </div>
                    <div className="font-semibold">
                      {formatCurrency(portfolioCash)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">
                      {t("rebalance.investCash.spending", "Spending")}
                    </div>
                    <div className="font-semibold text-green-600">
                      {formatCurrency(totalSpending)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">
                      {t("rebalance.investCash.cashAfter", "Cash After")}
                    </div>
                    <div
                      className={`font-semibold ${
                        cashAfter < 0
                          ? "text-red-600"
                          : cashAfter < portfolioCash * 0.05
                            ? "text-orange-600"
                            : "text-blue-600"
                      }`}
                    >
                      {formatCurrency(cashAfter)}
                    </div>
                  </div>
                </div>
                {cashAfter < 0 && (
                  <div className="mt-2 text-xs text-amber-600">
                    <i className="fas fa-exclamation-triangle mr-1"></i>
                    {t(
                      "rebalance.investCash.insufficientCash",
                      "Warning: Insufficient cash. You may still create proposed transactions for review.",
                    )}
                  </div>
                )}
              </div>

              {/* Broker Selection */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t("trn.broker", "Broker")}
                  </label>
                  <a
                    href="/brokers"
                    target="_blank"
                    className="text-xs text-emerald-600 hover:text-emerald-700"
                  >
                    {t("brokers.manage", "Manage")}
                  </a>
                </div>
                <select
                  value={selectedBrokerId || ""}
                  onChange={(e) =>
                    setSelectedBrokerId(e.target.value || undefined)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">
                    {t("trn.broker.none", "-- No broker --")}
                  </option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>
                      {broker.name}
                      {broker.accountNumber ? ` (${broker.accountNumber})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-sm text-gray-500 flex items-start gap-2">
                <i className="fas fa-info-circle mt-0.5"></i>
                <span>
                  {t(
                    "rebalance.investCash.proposedNote",
                    "Transactions will be created as PROPOSED. You can review and settle them from the transaction list.",
                  )}
                </span>
              </div>
            </div>

            {/* Step 2 footer */}
            <div className="flex justify-between mt-6 pt-4 border-t">
              <button
                onClick={handleBack}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                {t("back", "Back")}
              </button>
              <button
                onClick={handleCommit}
                disabled={committing || buyItems.length === 0}
                className={`px-4 py-2 rounded text-white transition-colors ${
                  !committing && buyItems.length > 0
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                {committing ? (
                  <span className="flex items-center">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    {t("creating", "Creating...")}
                  </span>
                ) : (
                  <>
                    <i className="fas fa-check mr-2"></i>
                    {t(
                      "rebalance.investCash.createProposed",
                      "Create Proposed",
                    )}{" "}
                    ({formatCurrency(totalSpending)})
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default InvestCashDialog
