import React, { useState, useCallback, useMemo, useEffect } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import Link from "next/link"
import { TableSkeletonLoader } from "@components/ui/SkeletonLoader"
import CashSummaryPanel from "@components/features/rebalance/execution/CashSummaryPanel"
import {
  ExecutionDto,
  ExecutionItemDto,
  ExecutionItemUpdate,
} from "types/rebalance"

function ExecuteRebalancePage(): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()
  const { planId, portfolios, executionId, source } = router.query

  const portfolioIds = useMemo(
    () => (portfolios ? (portfolios as string).split(",") : []),
    [portfolios],
  )

  // Decode source URL for breadcrumb navigation
  const sourceUrl = source ? decodeURIComponent(source as string) : "/holdings"
  const isAggregated = sourceUrl.includes("aggregated")

  // State
  const [execution, setExecution] = useState<ExecutionDto | null>(null)
  const [step, setStep] = useState<"configure" | "preview">("configure")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Local state for pending changes (synced to server on save)
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, number | undefined>
  >({})
  const [localExclusions, setLocalExclusions] = useState<
    Record<string, boolean>
  >({})

  // Create or load execution
  const initializeExecution = useCallback(async () => {
    if (executionId) {
      // Load existing execution
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/rebalance/executions/${executionId}`,
        )
        if (!response.ok) {
          setError(`Failed to load execution: ${response.status}`)
          return
        }
        const data = await response.json()
        setExecution(data.data)
        // Initialize local state from execution items
        const overrides: Record<string, number | undefined> = {}
        const exclusions: Record<string, boolean> = {}
        data.data.items.forEach((item: ExecutionItemDto) => {
          if (item.hasOverride) {
            overrides[item.assetId] = item.effectiveTarget
          }
          if (item.excluded) {
            exclusions[item.assetId] = true
          }
        })
        setLocalOverrides(overrides)
        setLocalExclusions(exclusions)
      } catch (err) {
        console.error("Failed to load execution:", err)
        setError(
          err instanceof Error ? err.message : "Failed to load execution",
        )
      } finally {
        setLoading(false)
      }
    } else if (planId && portfolioIds.length > 0) {
      // Create new execution
      setLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/rebalance/executions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            portfolioIds,
          }),
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          setError(
            errorData.message || `Failed to create execution: ${response.status}`,
          )
          return
        }
        const data = await response.json()
        setExecution(data.data)
        // Update URL to include executionId (for resuming later), preserve source
        const sourceParam = source ? `&source=${encodeURIComponent(source as string)}` : ""
        router.replace(
          `/rebalance/execute?executionId=${data.data.id}${sourceParam}`,
          undefined,
          { shallow: true },
        )
      } catch (err) {
        console.error("Failed to create execution:", err)
        setError(
          err instanceof Error ? err.message : "Failed to create execution",
        )
      } finally {
        setLoading(false)
      }
    }
  }, [executionId, planId, portfolioIds, router, source])

  // Initialize on mount
  useEffect(() => {
    if (!execution && !loading && (executionId || (planId && portfolioIds.length > 0))) {
      initializeExecution()
    }
  }, [execution, loading, executionId, planId, portfolioIds.length, initializeExecution])

  // Save execution changes
  const handleSave = useCallback(async () => {
    if (!execution) return

    setSaving(true)
    try {
      const itemUpdates: ExecutionItemUpdate[] = execution.items.map((item) => ({
        assetId: item.assetId,
        effectiveTargetOverride: localOverrides[item.assetId],
        excluded: localExclusions[item.assetId] ?? false,
      }))

      const response = await fetch(
        `/api/rebalance/executions/${execution.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemUpdates,
          }),
        },
      )

      if (!response.ok) {
        setError(`Failed to save: ${response.status}`)
        return
      }

      const data = await response.json()
      setExecution(data.data)
      setHasChanges(false)
    } catch (err) {
      console.error("Failed to save execution:", err)
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }, [execution, localOverrides, localExclusions])

  // Refresh holdings
  const handleRefresh = useCallback(async () => {
    if (!execution) return

    // Save any pending changes first
    if (hasChanges) {
      await handleSave()
    }

    setRefreshing(true)
    try {
      const response = await fetch(
        `/api/rebalance/executions/${execution.id}/refresh`,
        { method: "POST" },
      )

      if (!response.ok) {
        setError(`Failed to refresh: ${response.status}`)
        return
      }

      const data = await response.json()
      setExecution(data.data)
      // Re-initialize local state
      const overrides: Record<string, number | undefined> = {}
      const exclusions: Record<string, boolean> = {}
      data.data.items.forEach((item: ExecutionItemDto) => {
        if (item.hasOverride) {
          overrides[item.assetId] = item.effectiveTarget
        }
        if (item.excluded) {
          exclusions[item.assetId] = true
        }
      })
      setLocalOverrides(overrides)
      setLocalExclusions(exclusions)
      setHasChanges(false)
    } catch (err) {
      console.error("Failed to refresh:", err)
      setError(err instanceof Error ? err.message : "Failed to refresh")
    } finally {
      setRefreshing(false)
    }
  }, [execution, hasChanges, handleSave])

  // Handle target percentage change
  const handleTargetChange = (assetId: string, value: number): void => {
    setLocalOverrides((prev) => ({ ...prev, [assetId]: value }))
    setHasChanges(true)
  }

  // Handle exclude toggle - just marks asset as excluded, doesn't change % value
  const handleExcludeToggle = (assetId: string): void => {
    setLocalExclusions((prev) => ({ ...prev, [assetId]: !prev[assetId] }))
    setHasChanges(true)
  }

  // Set all targets to current weights (exclude cash)
  const handleSetAllToCurrent = (): void => {
    if (!execution) return
    const overrides: Record<string, number> = {}
    execution.items.forEach((item) => {
      if (!item.isCash) {
        overrides[item.assetId] = item.snapshotWeight
      }
    })
    setLocalOverrides(overrides)
    setHasChanges(true)
  }

  // Set all targets to model target weights
  const handleSetAllToTarget = (): void => {
    setLocalOverrides({})
    setLocalExclusions({})
    setHasChanges(true)
  }

  // Set all non-cash targets to 0% and cash to 100% (sell everything to cash)
  const handleSetAllToZero = (): void => {
    if (!execution) return
    const overrides: Record<string, number> = {}
    execution.items.forEach((item) => {
      if (item.isCash) {
        overrides[item.assetId] = 1 // Cash becomes 100%
      } else {
        overrides[item.assetId] = 0
      }
    })
    setLocalOverrides(overrides)
    setLocalExclusions({})
    setHasChanges(true)
  }

  // Set single item to current weight
  const handleSetToCurrent = (assetId: string, currentWeight: number): void => {
    setLocalOverrides((prev) => ({ ...prev, [assetId]: currentWeight }))
    setHasChanges(true)
  }

  // Set single item to target weight (remove override)
  const handleSetToTarget = (assetId: string): void => {
    setLocalOverrides((prev) => {
      const newOverrides = { ...prev }
      delete newOverrides[assetId]
      return newOverrides
    })
    setLocalExclusions((prev) => {
      const newExcluded = { ...prev }
      delete newExcluded[assetId]
      return newExcluded
    })
    setHasChanges(true)
  }

  // Calculate display items with local overrides applied
  // Default: Cash stays at current weight, other assets scale based on PLAN target weights
  // Excluded assets use same calculation but don't generate transactions
  const displayItems = useMemo(() => {
    if (!execution) return []

    const totalPortfolioValue = execution.totalPortfolioValue

    // Find the cash item - cash stays at current weight by default (not scaled)
    const cashItem = execution.items.find((item) => item.isCash)
    const cashEffectiveTarget = cashItem
      ? (localOverrides[cashItem.assetId] ?? cashItem.snapshotWeight)
      : 0

    // Calculate available allocation for non-cash assets (1 - cash target)
    const availableForAssets = 1 - cashEffectiveTarget

    // Sum of PLAN target weights for all non-cash assets (for proportional scaling)
    // Excluded assets are included in the calculation - they just don't generate transactions
    const totalPlanTargetWeights = execution.items
      .filter((item) => !item.isCash)
      .reduce((sum, item) => sum + item.planTargetWeight, 0)

    return execution.items.map((item) => {
      const isCash = item.isCash ?? false
      const isExcluded = localExclusions[item.assetId] ?? item.excluded

      let effectiveTarget: number
      if (isCash) {
        // Cash uses its own override or current weight (not scaled by default)
        effectiveTarget = localOverrides[item.assetId] ?? item.snapshotWeight
      } else if (localOverrides[item.assetId] !== undefined) {
        // Asset has explicit override - use it directly
        effectiveTarget = localOverrides[item.assetId]!
      } else {
        // Scale asset based on its PLAN target weight proportion
        // Assets with 0% target in plan get 0% effective target
        // Excluded assets use same calculation - they just won't generate transactions
        effectiveTarget = totalPlanTargetWeights > 0
          ? (item.planTargetWeight / totalPlanTargetWeights) * availableForAssets
          : 0
      }

      const targetValue = totalPortfolioValue * effectiveTarget
      const deltaValue = targetValue - item.snapshotValue
      const price = item.snapshotPrice || 0
      const deltaQuantity = isCash ? deltaValue : (price > 0 ? Math.round(deltaValue / price) : 0)

      return {
        ...item,
        effectiveTarget,
        deltaValue,
        deltaQuantity,
        isExcluded,
        isCash,
      }
    })
  }, [execution, localOverrides, localExclusions])

  // Filter active items (non-zero delta, not excluded, not cash)
  const activeItems = displayItems.filter(
    (item) => !item.isExcluded && !item.isCash && Math.abs(item.deltaValue) > 100,
  )

  // Compute cash summary from display items (updates in real-time with user changes)
  const computedCashSummary = useMemo(() => {
    if (!execution) {
      return { currentMarketValue: 0, currentCash: 0, targetCash: 0, cashFromSales: 0, cashForPurchases: 0 }
    }

    const cashItem = displayItems.find((item) => item.isCash)
    const targetCash = execution.totalPortfolioValue * (cashItem?.effectiveTarget ?? 0)

    let cashFromSales = 0
    let cashForPurchases = 0

    for (const item of displayItems) {
      if (item.isCash || item.isExcluded) continue
      if (item.deltaValue < 0) {
        cashFromSales += Math.abs(item.deltaValue)
      } else if (item.deltaValue > 0) {
        cashForPurchases += item.deltaValue
      }
    }

    return {
      currentMarketValue: execution.totalPortfolioValue,
      currentCash: execution.snapshotCashValue,
      targetCash,
      cashFromSales,
      cashForPurchases,
    }
  }, [execution, displayItems])

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat(undefined, {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatPercent = (value: number): string => {
    return `${(value * 100).toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="w-full py-4">
        <TableSkeletonLoader rows={8} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full py-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 max-w-4xl mx-auto">
          <p>{error}</p>
          <button
            onClick={() => initializeExecution()}
            className="mt-2 text-sm underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!execution) {
    return (
      <div className="w-full py-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700 max-w-4xl mx-auto">
          {t("rebalance.execute.noData", "No execution data available")}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-4">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href={sourceUrl} className="hover:text-blue-600">
          {isAggregated
            ? t("holdings.aggregated", "Aggregated Holdings")
            : t("holdings.title", "Holdings")}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">
          {t("rebalance.execute.title", "Rebalance")}
        </span>
      </nav>

      {/* Header */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("rebalance.execute.title", "Rebalance Portfolio")}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {t("rebalance.execute.usingPlan", "Using plan")}:{" "}
              {execution.modelName} v{execution.planVersion}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
              title="Refresh holdings from portfolios"
            >
              <i
                className={`fas fa-sync-alt mr-1 ${refreshing ? "fa-spin" : ""}`}
              ></i>
              Refresh
            </button>
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-2 text-sm text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                <i
                  className={`fas ${saving ? "fa-spinner fa-spin" : "fa-save"} mr-1`}
                ></i>
                Save
              </button>
            )}
          </div>
        </div>

        <div className="pt-4 border-t">
          <CashSummaryPanel
            currentMarketValue={computedCashSummary.currentMarketValue}
            currentCash={computedCashSummary.currentCash}
            targetCash={computedCashSummary.targetCash}
            cashFromSales={computedCashSummary.cashFromSales}
            cashForPurchases={computedCashSummary.cashForPurchases}
            currency={execution.currency}
          />
        </div>
      </div>

      {step === "configure" ? (
        <>
          {/* Configuration Table */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg mb-6 overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    {t("rebalance.execute.executionPlan", "Execution Plan")}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {t(
                      "rebalance.execute.editTargets",
                      "Edit target % to adjust allocations. Exclude positions to maintain their current weight.",
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSetAllToCurrent}
                    className="px-3 py-1 text-xs text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                    title="Set all % to current weights (no changes)"
                  >
                    All → Current
                  </button>
                  <button
                    onClick={handleSetAllToTarget}
                    className="px-3 py-1 text-xs text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                    title="Reset all to target weights from model"
                  >
                    All → Target
                  </button>
                  <button
                    onClick={handleSetAllToZero}
                    className="px-3 py-1 text-xs text-red-600 bg-white border border-red-300 rounded hover:bg-red-50"
                    title="Set all assets to 0% (sell everything)"
                  >
                    All → 0
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-12">
                      <span title="Exclude from execution">
                        <i className="fas fa-ban"></i>
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("rebalance.execute.asset", "Asset")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("rebalance.execute.current", "Current")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("rebalance.execute.target", "Target")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      %
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("rebalance.execute.quantity", "Quantity")}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayItems.map((item) => {
                    const isCash = item.isCash
                    const isBuy = !item.isExcluded && !isCash && item.deltaValue > 100
                    const isSell = !item.isExcluded && !isCash && item.deltaValue < -100
                    const rowClass = isCash
                      ? "bg-blue-50 border-b-2 border-blue-200"
                      : item.isExcluded
                        ? "bg-gray-100 opacity-60"
                        : isBuy
                          ? "bg-green-50"
                          : isSell
                            ? "bg-red-50"
                            : ""
                    const quantityClass = isCash
                      ? "text-blue-700 font-medium"
                      : item.isExcluded
                        ? "text-gray-400"
                        : isBuy
                          ? "text-green-700 font-medium"
                          : isSell
                            ? "text-red-700 font-medium"
                            : "text-gray-500"

                    return (
                      <tr key={item.assetId} className={rowClass}>
                        <td className="px-2 py-3 text-center">
                          {!isCash && (
                            <input
                              type="checkbox"
                              checked={item.isExcluded}
                              onChange={() => handleExcludeToggle(item.assetId)}
                              className="h-4 w-4 text-gray-600 rounded border-gray-300 focus:ring-gray-500"
                              title={
                                item.isExcluded
                                  ? "Include in execution"
                                  : "Exclude from execution"
                              }
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className={`font-medium ${isCash ? "text-blue-900" : "text-gray-900"}`}>
                            {isCash && <i className="fas fa-coins mr-2 text-blue-500"></i>}
                            {item.assetCode || item.assetId}
                          </div>
                          {item.assetName && !isCash && (
                            <div className="text-xs text-gray-500">
                              {item.assetName}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() =>
                                handleSetToCurrent(
                                  item.assetId,
                                  item.snapshotWeight,
                                )
                              }
                              className="text-gray-400 hover:text-blue-600 p-0.5"
                              title="Copy to %"
                            >
                              <i className="fas fa-arrow-right text-xs"></i>
                            </button>
                            <div>
                              <div className={isCash ? "text-blue-900" : "text-gray-900"}>
                                {formatPercent(item.snapshotWeight)}
                              </div>
                              <div className={`text-xs ${isCash ? "text-blue-600" : "text-gray-500"}`}>
                                {formatCurrency(item.snapshotValue)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleSetToTarget(item.assetId)}
                              className="text-gray-400 hover:text-blue-600 p-0.5"
                              title="Copy to %"
                            >
                              <i className="fas fa-arrow-right text-xs"></i>
                            </button>
                            <span className={isCash ? "text-blue-600" : "text-gray-500"}>
                              {formatPercent(item.planTargetWeight)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={(item.effectiveTarget * 100).toFixed(2)}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              handleTargetChange(item.assetId, val / 100)
                            }}
                            disabled={item.isExcluded}
                            className={`w-20 px-2 py-1 text-right border rounded focus:ring-blue-500 focus:border-blue-500 ${
                              isCash
                                ? "border-blue-300 bg-blue-50"
                                : item.isExcluded
                                  ? "border-gray-300 bg-gray-100"
                                  : "border-gray-300"
                            }`}
                          />
                        </td>
                        <td className={`px-4 py-3 text-right ${quantityClass}`}>
                          {isCash ? (
                            <span>
                              {item.deltaValue > 0 ? "+" : ""}
                              {formatCurrency(item.deltaValue)}
                            </span>
                          ) : item.isExcluded ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <>
                              {item.deltaQuantity > 0 ? "+" : ""}
                              {item.deltaQuantity}
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            >
              {t("cancel", "Cancel")}
            </button>
            <button
              onClick={() => {
                if (hasChanges) {
                  handleSave().then(() => setStep("preview"))
                } else {
                  setStep("preview")
                }
              }}
              disabled={activeItems.length === 0}
              className={`px-4 py-2 rounded text-white transition-colors ${
                activeItems.length > 0
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {t("next", "Next")}:{" "}
              {t("rebalance.execute.reviewTransactions", "Review Transactions")}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Preview Table */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg mb-6 overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">
                {t(
                  "rebalance.execute.proposedTransactions",
                  "Proposed Transactions",
                )}
              </h2>
              <p className="text-sm text-gray-500">
                {activeItems.length}{" "}
                {t(
                  "rebalance.execute.transactionsToCreate",
                  "transactions to create",
                )}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("rebalance.execute.asset", "Asset")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("rebalance.execute.quantity", "Quantity")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("rebalance.execute.price", "Price")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("rebalance.execute.value", "Value")}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeItems.map((item) => {
                    const isBuy = item.deltaValue > 0
                    const rowClass = isBuy ? "bg-green-50" : "bg-red-50"
                    const valueClass = isBuy
                      ? "text-green-700"
                      : "text-red-700"

                    return (
                      <tr key={item.assetId} className={rowClass}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {item.assetCode || item.assetId}
                          </div>
                          {item.assetName && (
                            <div className="text-xs text-gray-500">
                              {item.assetName}
                            </div>
                          )}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-medium ${valueClass}`}
                        >
                          {item.deltaQuantity > 0 ? "+" : ""}
                          {item.deltaQuantity}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {item.snapshotPrice
                            ? `${formatCurrency(item.snapshotPrice)} ${item.priceCurrency || ""}`
                            : "-"}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-medium ${valueClass}`}
                        >
                          {item.deltaValue > 0 ? "+" : ""}
                          {formatCurrency(item.deltaValue)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cash Summary */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 mb-6">
            <CashSummaryPanel
              currentMarketValue={computedCashSummary.currentMarketValue}
              currentCash={computedCashSummary.currentCash}
              targetCash={computedCashSummary.targetCash}
              cashFromSales={computedCashSummary.cashFromSales}
              cashForPurchases={computedCashSummary.cashForPurchases}
              currency={execution.currency}
            />
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep("configure")}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            >
              {t("back", "Back")}
            </button>
            <button
              onClick={() => {
                // TODO: Execute transactions
                alert("Transaction execution coming soon!")
              }}
              className="px-4 py-2 rounded text-white bg-green-500 hover:bg-green-600 transition-colors"
            >
              <i className="fas fa-check mr-2"></i>
              {t("rebalance.execute.execute", "Execute Transactions")}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default withPageAuthRequired(ExecuteRebalancePage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
