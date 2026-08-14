import React, { useState, useMemo, useCallback } from "react"
import { formatCurrency } from "@lib/formatters"
import useSWR from "swr"
import { useRouter } from "next/router"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import { simpleFetcher, accountsKey } from "@utils/api/fetchHelper"
import { resolveBrokerCashAssetId } from "@utils/trns/tradeFormHelpers"
import BrokerSelect, {
  confirmBrokerSelection,
} from "@components/features/rebalance/common/BrokerSelect"
import ModelCard from "@components/features/rebalance/common/ModelCard"
import { useApprovedModels } from "@components/features/rebalance/hooks/useApprovedModels"
import {
  parseShorthandAmount,
  hasShorthandSuffix,
} from "@utils/formatting/amountParser"
import {
  ModelDto,
  ExecutionDto,
  ExecutionItemDto,
  ExecutionItemUpdate,
  CommitExecutionRequest,
  PlanDto,
} from "types/rebalance"
import { BrokerWithAccounts } from "types/beancounter"

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

// Track user edits to qty/price. Stored as the raw text the user typed so a
// half-finished number ("0.", "1.2") survives re-render — reformatting the
// value on every keystroke makes decimals impossible to enter.
interface ItemEdits {
  [assetId: string]: { quantity?: string; price?: string }
}

// A draft becomes a number for maths/submission. Blank or unparseable text
// counts as 0 so the preview totals match what is on screen.
const draftToNumber = (raw?: string): number | undefined => {
  if (raw === undefined) return undefined
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

// Text inputs (not type=number, which fights decimal entry) so keystrokes are
// screened here: digits and a single decimal point, any number of places.
const DECIMAL_DRAFT = /^\d*\.?\d*$/

const InvestCashDialog: React.FC<InvestCashDialogProps> = ({
  modalOpen,
  portfolioId,
  onClose,
  onSuccess,
}) => {
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

  // Fetch models with an approved current plan
  const { approvedModels: modelsWithApprovedPlans, isLoading: loadingModels } =
    useApprovedModels(modalOpen)

  const router = useRouter()

  // Fetch brokers (with settlement accounts) + the account assets, so the
  // commit can route cash into the selected broker's own cash line.
  const { data: brokersData } = useSWR(
    modalOpen ? "/api/brokers?includeAccounts=true" : null,
    simpleFetcher("/api/brokers?includeAccounts=true"),
  )
  const brokers: BrokerWithAccounts[] = brokersData?.data || []
  const { data: accountAssetsData } = useSWR(
    modalOpen ? accountsKey : null,
    simpleFetcher(accountsKey),
  )
  const accountAssets = useMemo(
    () =>
      accountAssetsData?.data
        ? (Object.values(accountAssetsData.data) as any[])
        : [],
    [accountAssetsData],
  )

  // Convenience: if the user has exactly one broker, pre-select it
  // when the dialog opens. Skip if user already chose (or cleared it).
  // Render-phase trigger pattern: re-evaluate when modalOpen or the broker
  // count changes (mirrors the prior effect deps) without a cascading effect.
  const [prevBrokerTrigger, setPrevBrokerTrigger] = useState<string>(
    `${modalOpen}:${brokers.length}`,
  )
  const brokerTrigger = `${modalOpen}:${brokers.length}`
  if (brokerTrigger !== prevBrokerTrigger) {
    setPrevBrokerTrigger(brokerTrigger)
    if (brokers.length === 1 && selectedBrokerId === undefined) {
      setSelectedBrokerId(brokers[0].id)
    }
  }

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
    (
      item: ExecutionItemDto,
    ): {
      qty: number
      price: number
      value: number
      qtyText: string
      priceText: string
    } => {
      const edits = itemEdits[item.assetId] || {}
      const qty = draftToNumber(edits.quantity) ?? item.deltaQuantity
      const price = draftToNumber(edits.price) ?? item.snapshotPrice ?? 0
      return {
        qty,
        price,
        value: qty * price,
        qtyText: edits.quantity ?? String(qty),
        priceText: edits.price ?? String(price),
      }
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
  const handleQuantityChange = (assetId: string, newQty: string): void => {
    if (!DECIMAL_DRAFT.test(newQty)) return
    setItemEdits((prev) => ({
      ...prev,
      [assetId]: { ...prev[assetId], quantity: newQty },
    }))
  }

  // Handle price change
  const handlePriceChange = (assetId: string, newPrice: string): void => {
    if (!DECIMAL_DRAFT.test(newPrice)) return
    setItemEdits((prev) => ({
      ...prev,
      [assetId]: { ...prev[assetId], price: newPrice },
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

    // Warn (but don't block) when the user has more than one broker but
    // hasn't tagged the orders. They can still proceed if they meant to.
    if (!confirmBrokerSelection(brokers.length, selectedBrokerId)) return

    setCommitting(true)
    setError(null)

    // Single source of truth for the commit's trn status — used both in
    // the request body and to decide whether to navigate to the
    // proposed-transactions list afterwards (only relevant for PROPOSED).
    const transactionStatus: "PROPOSED" | "SETTLED" = "PROPOSED"

    try {
      // Only send updates if user made edits
      if (Object.keys(itemEdits).length > 0) {
        const itemUpdates: ExecutionItemUpdate[] = buyItems
          .filter((item) => itemEdits[item.assetId])
          .map((item) => ({
            assetId: item.assetId,
            quantity: draftToNumber(itemEdits[item.assetId]?.quantity),
            price: draftToNumber(itemEdits[item.assetId]?.price),
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

      // Route settlement into the selected broker's own cash line (e.g.
      // IBRK-USD) when resolvable; otherwise omit so the backend falls back
      // to the generic CASH/{ccy} for the execution currency.
      const cashAssetId =
        resolveBrokerCashAssetId({
          brokerId: selectedBrokerId,
          currency: execution.currency,
          brokers,
          accountAssets,
        }) ?? undefined

      // Commit to create transactions
      const commitRequest: CommitExecutionRequest = {
        portfolioId,
        transactionStatus,
        brokerId: selectedBrokerId,
        cashAssetId,
      }
      const response = await fetch(
        `/api/rebalance/executions/${execution.id}/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(commitRequest),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.message || `Failed to commit transactions`)
        return
      }

      // PROPOSED commits navigate away; skip the parent refresh so the
      // caller's `router.replace(asPath)` doesn't race with our push and
      // strand the user on the current page.
      handleClose()
      if (transactionStatus === "PROPOSED") {
        router.push("/trns/proposed")
      } else {
        onSuccess()
      }
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

  if (!modalOpen) return null

  const stepFooter =
    step === "input" ? (
      <>
        <Dialog.CancelButton onClick={handleClose} label={"Cancel"} />
        <Dialog.SubmitButton
          onClick={handlePreview}
          label={"Preview"}
          loadingLabel={"Loading..."}
          isSubmitting={loading}
          disabled={
            !selectedModel || !amount || parseShorthandAmount(amount) <= 0
          }
          variant="blue"
        />
      </>
    ) : (
      <>
        <Dialog.CancelButton onClick={handleBack} label={"Back"} />
        <Dialog.SubmitButton
          onClick={handleCommit}
          label={`${"Create Proposed"} (${formatCurrency(totalSpending)})`}
          loadingLabel={"Creating..."}
          isSubmitting={committing}
          disabled={buyItems.length === 0}
          variant="green"
        />
      </>
    )

  return (
    <Dialog
      title={step === "input" ? "Invest Cash" : "Preview"}
      onClose={handleClose}
      maxWidth="2xl"
      scrollable={true}
      footer={stepFooter}
    >
      <Dialog.ErrorAlert message={error} />

      {step === "input" ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {"Investment Amount"}
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
              {"Use h=100, k=1000, m=1000000 (e.g., 4k = 4,000)"}
              {amount && hasShorthandSuffix(amount) && (
                <span className="ml-2 text-blue-600 font-medium">
                  = {parseShorthandAmount(amount).toLocaleString()}
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {"Select Model"}
            </label>

            {loadingModels ? (
              <div className="py-4 text-center text-gray-500">
                <Spinner className="mr-2" />
                {"Loading..."}
              </div>
            ) : modelsWithApprovedPlans.length === 0 ? (
              <div className="py-4 text-center text-gray-500">
                <i className="fas fa-folder-open text-2xl mb-2"></i>
                <p className="text-sm">
                  {
                    "No approved models found. Create a model and approve a plan first."
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {modelsWithApprovedPlans.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    variant="grid"
                    selected={selectedModel?.id === model.id}
                    onClick={() => setSelectedModel(model)}
                  />
                ))}
              </div>
            )}

            {/* Plan Preview - show when a model is selected */}
            {selectedModel && (
              <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700">
                    <i className="fas fa-chart-pie mr-2 text-gray-400"></i>
                    {"Plan Allocations"}
                  </h4>
                </div>
                {loadingPlan ? (
                  <div className="py-4 text-center text-gray-500 text-sm">
                    <Spinner className="mr-2" />
                    {"Loading..."}
                  </div>
                ) : planAssets.length === 0 ? (
                  <div className="py-4 text-center text-gray-500 text-sm">
                    {"No assets in plan"}
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            {"Asset"}
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">
                            {"Weight"}
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
                                {"Cash"}
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
      ) : (
        <div className="space-y-4">
          {/* Mobile: card per buy item */}
          <div className="sm:hidden space-y-2">
            {buyItems.map((item) => {
              const { value, qtyText, priceText } = getItemValues(item)
              const displayCode = formatAssetCode(item.assetCode)
              return (
                <div
                  key={item.assetId}
                  className="bg-green-50 border border-gray-200 rounded-lg p-3"
                >
                  <div
                    className="flex items-start justify-between gap-2 mb-3"
                    title={item.rationale || undefined}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">
                        {displayCode || item.assetId}
                        {item.rationale && (
                          <i className="fas fa-info-circle ml-1 text-gray-400 text-xs"></i>
                        )}
                      </div>
                      {item.assetName && (
                        <div className="text-xs text-gray-500 truncate">
                          {item.assetName}
                        </div>
                      )}
                    </div>
                    <div className="text-green-700 font-semibold text-sm whitespace-nowrap">
                      {formatCurrency(value)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="block text-xs text-gray-500 mb-1">
                        {"Qty"}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={qtyText}
                        onChange={(e) =>
                          handleQuantityChange(item.assetId, e.target.value)
                        }
                        className="w-full px-3 py-2 text-base text-right border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-xs text-gray-500 mb-1">
                        {"Price"}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={priceText}
                        onChange={(e) =>
                          handlePriceChange(item.assetId, e.target.value)
                        }
                        className="w-full px-3 py-2 text-base text-right border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                      />
                    </label>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {"Asset"}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">
                    {"Qty"}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">
                    {"Price"}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">
                    {"Value"}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {buyItems.map((item) => {
                  const { value, qtyText, priceText } = getItemValues(item)
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
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          aria-label="Qty"
                          value={qtyText}
                          onChange={(e) =>
                            handleQuantityChange(item.assetId, e.target.value)
                          }
                          className="w-full px-2 py-1 text-right text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          aria-label="Price"
                          value={priceText}
                          onChange={(e) =>
                            handlePriceChange(item.assetId, e.target.value)
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
                <div className="text-gray-500">{"Portfolio Cash"}</div>
                <div className="font-semibold">
                  {formatCurrency(portfolioCash)}
                </div>
              </div>
              <div>
                <div className="text-gray-500">{"Spending"}</div>
                <div className="font-semibold text-green-600">
                  {formatCurrency(totalSpending)}
                </div>
              </div>
              <div>
                <div className="text-gray-500">{"Cash After"}</div>
                <div
                  className={`font-semibold ${
                    cashAfter < 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {formatCurrency(cashAfter)}
                </div>
              </div>
            </div>
            {cashAfter < 0 && (
              <div className="mt-2 text-xs text-amber-600">
                <i className="fas fa-exclamation-triangle mr-1"></i>
                {
                  "Warning: Insufficient cash. You may still create proposed transactions for review."
                }
              </div>
            )}
          </div>

          {/* Broker Selection */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="invest-cash-broker"
                className="text-sm font-medium text-gray-700"
              >
                {"Broker"}
              </label>
              <a
                href="/brokers"
                target="_blank"
                className="text-xs text-invest-600 hover:text-invest-700"
              >
                {"Manage"}
              </a>
            </div>
            <BrokerSelect
              id="invest-cash-broker"
              brokers={brokers}
              value={selectedBrokerId}
              onChange={setSelectedBrokerId}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <div className="text-sm text-gray-500 flex items-start gap-2">
            <i className="fas fa-info-circle mt-0.5"></i>
            <span>
              {
                "Transactions will be created as PROPOSED. You can review and settle them from the transaction list."
              }
            </span>
          </div>
        </div>
      )}
    </Dialog>
  )
}

export default InvestCashDialog
