import React, { useState, useMemo, useEffect } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import Link from "next/link"
import { TableSkeletonLoader } from "@components/ui/SkeletonLoader"
import CashSummaryPanel from "@components/features/rebalance/execution/CashSummaryPanel"
import { getAssetCurrency } from "@lib/assets/assetUtils"
import { useRebalanceExecution } from "@hooks/useRebalanceExecution"

function ExecuteRebalancePage(): React.ReactElement {
  const router = useRouter()
  const {
    planId,
    portfolios,
    executionId,
    source,
    filterByModel: filterByModelParam,
  } = router.query

  const portfolioIds = useMemo(
    () => (portfolios ? (portfolios as string).split(",") : []),
    [portfolios],
  )

  // Decode source URL for breadcrumb navigation
  const sourceUrl = source ? decodeURIComponent(source as string) : "/holdings"
  const isAggregated = sourceUrl.includes("aggregated")

  // Page-only UI state
  const [step, setStep] = useState<"configure" | "preview">("configure")

  // Hook handles all data fetching, state, and operations
  const {
    execution,
    displayItems,
    activeItems,
    cashSummary,
    settlementAccounts,
    brokers,
    selectedSettlementAccount,
    setSelectedSettlementAccount,
    selectedBrokerId,
    setSelectedBrokerId,
    states,
    handlers,
    createdExecutionId,
  } = useRebalanceExecution({
    executionId: executionId as string | undefined,
    planId: planId as string | undefined,
    portfolioIds,
    filterByModel: filterByModelParam === "true",
  })

  // Handle URL update after new execution creation
  useEffect(() => {
    if (createdExecutionId) {
      const sourceParam = source
        ? `&source=${encodeURIComponent(source as string)}`
        : ""
      router.replace(
        `/rebalance/execute?executionId=${createdExecutionId}${sourceParam}`,
        undefined,
        { shallow: true },
      )
    }
  }, [createdExecutionId, source, router])

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

  if (states.loading) {
    return (
      <div className="w-full py-4">
        <TableSkeletonLoader rows={8} />
      </div>
    )
  }

  if (states.error) {
    return (
      <div className="w-full py-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 max-w-4xl mx-auto">
          <p>{states.error}</p>
          <button
            onClick={() => {
              handlers.setError(null)
              handlers.initialize()
            }}
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
          {"No execution data available"}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-4">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href={sourceUrl} className="hover:text-invest-600">
          {isAggregated ? "Aggregated Holdings" : "Holdings"}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{"Rebalance"}</span>
      </nav>

      {/* Header */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {"Rebalance Portfolio"}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {"Using plan"}: {execution.modelName} v{execution.planVersion}
              {execution.filterByModel && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  <i className="fas fa-filter mr-1"></i>
                  {"Model positions only"}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlers.refresh}
              disabled={states.refreshing}
              className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
              title="Refresh holdings from portfolios"
            >
              <i
                className={`fas fa-sync-alt mr-1 ${states.refreshing ? "fa-spin" : ""}`}
              ></i>
              Refresh
            </button>
            {states.hasChanges && (
              <button
                onClick={handlers.save}
                disabled={states.saving}
                className="px-3 py-2 text-sm text-white bg-invest-500 rounded hover:bg-invest-600 disabled:opacity-50"
              >
                <i
                  className={`fas ${states.saving ? "fa-spinner fa-spin" : "fa-save"} mr-1`}
                ></i>
                Save
              </button>
            )}
          </div>
        </div>

        <div className="pt-4 border-t">
          <CashSummaryPanel
            currentMarketValue={cashSummary.currentMarketValue}
            currentCash={cashSummary.currentCash}
            targetCash={cashSummary.targetCash}
            cashFromSales={cashSummary.cashFromSales}
            cashForPurchases={cashSummary.cashForPurchases}
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
                    {"Execution Plan"}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {
                      "Edit target % to adjust allocations. Exclude positions to maintain their current weight."
                    }
                  </p>
                  {/* Allocation Method Toggle */}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-500">
                      {"Allocation:"}
                    </span>
                    <div
                      className="inline-flex rounded-md shadow-sm"
                      role="group"
                    >
                      <button
                        type="button"
                        onClick={handlers.setAllToTarget}
                        className={`px-3 py-1 text-xs font-medium rounded-l-md border ${
                          displayItems.every(
                            (i) =>
                              i.isCash ||
                              i.effectiveTarget === i.planTargetWeight,
                          )
                            ? "bg-invest-100 text-invest-700 border-invest-200"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                        title="Use original model target weights - helps rebalance toward targets"
                      >
                        Model
                      </button>
                      <button
                        type="button"
                        onClick={handlers.setAllToAdjusted}
                        className={`px-3 py-1 text-xs font-medium rounded-r-md border-t border-b border-r ${
                          states.hasChanges
                            ? "bg-amber-100 text-amber-700 border-amber-300"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                        title="Use return-adjusted weights - maintains current portfolio proportions"
                      >
                        Adjusted
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlers.setAllToCurrent}
                    className="px-3 py-1 text-xs text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                    title="Set all % to current weights (no changes)"
                  >
                    All &rarr; Current
                  </button>
                  <button
                    onClick={handlers.setAllToTarget}
                    className="px-3 py-1 text-xs text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                    title="Reset all to target weights from model"
                  >
                    All &rarr; Target
                  </button>
                  <button
                    onClick={handlers.setAllToAdjusted}
                    className="px-3 py-1 text-xs text-amber-600 bg-white border border-amber-300 rounded hover:bg-amber-50"
                    title="Set all to return-adjusted targets (accounts for price movements)"
                  >
                    All &rarr; Adjusted
                  </button>
                  <button
                    onClick={handlers.setAllToZero}
                    className="px-3 py-1 text-xs text-red-600 bg-white border border-red-300 rounded hover:bg-red-50"
                    title="Set all assets to 0% (sell everything)"
                  >
                    All &rarr; 0
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
                      {"Asset"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {"Current"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {"Target"}
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                      title="Return-adjusted target accounting for price movements since model creation"
                    >
                      {"Adjusted"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      %
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {"Quantity"}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayItems.map((item) => {
                    const isCash = item.isCash
                    const isBuy =
                      !item.isExcluded && !isCash && item.deltaValue > 100
                    const isSell =
                      !item.isExcluded && !isCash && item.deltaValue < -100
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
                              onChange={() =>
                                handlers.excludeToggle(item.assetId)
                              }
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
                          <div
                            className={`font-medium ${isCash ? "text-blue-900" : "text-gray-900"}`}
                            title={item.rationale || undefined}
                          >
                            {isCash && (
                              <i className="fas fa-coins mr-2 text-blue-500"></i>
                            )}
                            {item.assetCode || item.assetId}
                            {item.rationale && !isCash && (
                              <i
                                className="fas fa-info-circle ml-1 text-gray-400 text-xs cursor-help"
                                title={item.rationale}
                              ></i>
                            )}
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
                                handlers.setToCurrent(
                                  item.assetId,
                                  item.snapshotWeight,
                                )
                              }
                              className="text-gray-400 hover:text-invest-600 p-0.5"
                              title="Copy to %"
                            >
                              <i className="fas fa-arrow-right text-xs"></i>
                            </button>
                            <div>
                              <div
                                className={
                                  isCash ? "text-blue-900" : "text-gray-900"
                                }
                              >
                                {formatPercent(item.snapshotWeight)}
                              </div>
                              <div
                                className={`text-xs ${isCash ? "text-blue-600" : "text-gray-500"}`}
                              >
                                {formatCurrency(item.snapshotValue)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handlers.setToTarget(item.assetId)}
                              className="text-gray-400 hover:text-invest-600 p-0.5"
                              title="Copy to %"
                            >
                              <i className="fas fa-arrow-right text-xs"></i>
                            </button>
                            <span
                              className={
                                isCash ? "text-blue-600" : "text-gray-500"
                              }
                            >
                              {formatPercent(item.planTargetWeight)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.returnAdjustedTarget != null ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() =>
                                  handlers.targetChange(
                                    item.assetId,
                                    item.returnAdjustedTarget!,
                                  )
                                }
                                className="text-gray-400 hover:text-invest-600 p-0.5"
                                title="Copy return-adjusted target to %"
                              >
                                <i className="fas fa-arrow-right text-xs"></i>
                              </button>
                              <span
                                className={
                                  isCash ? "text-blue-600" : "text-amber-600"
                                }
                                title="Target adjusted for price movements since model creation"
                              >
                                {formatPercent(item.returnAdjustedTarget)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
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
                              handlers.targetChange(item.assetId, val / 100)
                            }}
                            disabled={item.isExcluded}
                            className={`w-20 px-2 py-1 text-right border rounded focus:ring-invest-500 focus:border-invest-500 ${
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
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-2 py-3"></td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {"Total"}
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">
                      {formatPercent(
                        displayItems.reduce(
                          (sum, item) => sum + item.planTargetWeight,
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-700">
                      {(() => {
                        const total = displayItems.reduce(
                          (sum, item) => sum + (item.returnAdjustedTarget ?? 0),
                          0,
                        )
                        const hasAdjusted = displayItems.some(
                          (item) => item.returnAdjustedTarget != null,
                        )
                        return hasAdjusted ? formatPercent(total) : "-"
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatPercent(
                        displayItems.reduce(
                          (sum, item) => sum + item.effectiveTarget,
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            >
              {"Cancel"}
            </button>
            <button
              onClick={async () => {
                if (states.hasChanges) {
                  const success = await handlers.save()
                  if (success) setStep("preview")
                } else {
                  setStep("preview")
                }
              }}
              disabled={activeItems.length === 0}
              className={`px-4 py-2 rounded text-white transition-colors ${
                activeItems.length > 0
                  ? "bg-invest-500 hover:bg-invest-600"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {"Next"}: {"Review Transactions"}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Preview Table */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg mb-6 overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">
                {"Proposed Transactions"}
              </h2>
              <p className="text-sm text-gray-500">
                {activeItems.length} {"transactions to create"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {"Asset"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {"Quantity"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {"Price"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {"Value"}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeItems.map((item) => {
                    const isBuy = item.deltaValue > 0
                    const rowClass = isBuy ? "bg-green-50" : "bg-red-50"
                    const valueClass = isBuy ? "text-green-700" : "text-red-700"

                    return (
                      <tr key={item.assetId} className={rowClass}>
                        <td className="px-4 py-3">
                          <div
                            className="font-medium text-gray-900"
                            title={item.rationale || undefined}
                          >
                            {item.assetCode || item.assetId}
                            {item.rationale && (
                              <i
                                className="fas fa-info-circle ml-1 text-gray-400 text-xs cursor-help"
                                title={item.rationale}
                              ></i>
                            )}
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
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {"Total"}
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {(() => {
                        const total = activeItems.reduce(
                          (sum, item) => sum + item.deltaValue,
                          0,
                        )
                        return (
                          <span
                            className={
                              total > 0
                                ? "text-green-700"
                                : total < 0
                                  ? "text-red-700"
                                  : ""
                            }
                          >
                            {total > 0 ? "+" : ""}
                            {formatCurrency(total)}
                          </span>
                        )
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Cash Summary */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 mb-6">
            <CashSummaryPanel
              currentMarketValue={cashSummary.currentMarketValue}
              currentCash={cashSummary.currentCash}
              targetCash={cashSummary.targetCash}
              cashFromSales={cashSummary.cashFromSales}
              cashForPurchases={cashSummary.cashForPurchases}
              currency={execution.currency}
            />
          </div>

          {/* Broker and Settlement Account Selection */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Broker Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-medium text-gray-900">
                    {"Broker"}
                  </h3>
                  <a
                    href="/brokers"
                    target="_blank"
                    className="text-xs text-invest-600 hover:text-invest-700"
                  >
                    {"Manage"}
                  </a>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  {"Select the broker for all proposed transactions"}
                </p>
                <select
                  value={selectedBrokerId || ""}
                  onChange={(e) =>
                    setSelectedBrokerId(e.target.value || undefined)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-invest-500 focus:border-invest-500"
                >
                  <option value="">{"-- No broker --"}</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>
                      {broker.name}
                      {broker.accountNumber ? ` (${broker.accountNumber})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Settlement Account Selection */}
              {settlementAccounts.length > 0 && (
                <div>
                  <h3 className="text-md font-medium text-gray-900 mb-3">
                    {"Settlement Account"}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {
                      "Select the brokerage account to debit/credit for these transactions"
                    }
                  </p>
                  <select
                    value={selectedSettlementAccount || ""}
                    onChange={(e) =>
                      setSelectedSettlementAccount(e.target.value || undefined)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-invest-500 focus:border-invest-500"
                  >
                    <option value="">
                      {"No settlement account (use default)"}
                    </option>
                    {settlementAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name || account.code} (
                        {getAssetCurrency(account)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep("configure")}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            >
              {"Back"}
            </button>
            <button
              onClick={async () => {
                const result = await handlers.commit()
                if (result) {
                  router.push(`/trns?portfolioId=${result.portfolioId}`)
                }
              }}
              disabled={states.committing || activeItems.length === 0}
              className={`px-4 py-2 rounded text-white transition-colors ${
                states.committing || activeItems.length === 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-invest-500 hover:bg-invest-600"
              }`}
            >
              <i
                className={`fas ${states.committing ? "fa-spinner fa-spin" : "fa-check"} mr-2`}
              ></i>
              {states.committing ? "Executing..." : "Execute Transactions"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default withPageAuthRequired(ExecuteRebalancePage)
