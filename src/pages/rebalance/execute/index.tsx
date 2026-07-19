import React, { useState, useMemo, useEffect } from "react"
import {
  formatCurrency,
  formatPercent,
  formatSignedNumber,
} from "@lib/formatters"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Alert from "@components/ui/Alert"
import { useRouter } from "next/router"
import Link from "next/link"
import { TableSkeletonLoader } from "@components/ui/SkeletonLoader"
import CashSummaryPanel from "@components/features/rebalance/execution/CashSummaryPanel"
import PriceChartPopup from "@components/features/holdings/PriceChartPopup"
import AssetInsightPopup from "@components/features/rebalance/models/AssetInsightPopup"
import {
  useRebalanceExecution,
  DisplayItem,
} from "@hooks/useRebalanceExecution"
import { Asset } from "types/beancounter"
import { ExecutionDto } from "types/rebalance"

type SliderStep = 5 | 1 | 0.01

const SLIDER_STEP_OPTIONS: { value: SliderStep; label: string }[] = [
  { value: 5, label: "5%" },
  { value: 1, label: "1%" },
  { value: 0.01, label: "0.01%" },
]

/** Round a raw percent value to the nearest multiple of `step`, guarding
 * against floating-point drift (e.g. 0.01 steps producing 14.999999998). */
function snapToStep(value: number, step: number): number {
  const snapped = Math.round(value / step) * step
  return Math.round(snapped * 100) / 100
}

/** Builds a minimal Asset for PriceChartPopup from a rebalance display row.
 * The execution DTO only carries id/code/name/price — market and category
 * are never resolved server-side for this flow, so a placeholder satisfies
 * the Asset contract without inventing data; PriceChartPopup replaces the
 * display name/market once its own price-history fetch resolves. */
function toChartAsset(item: DisplayItem): Asset {
  return {
    id: item.assetId,
    code: item.assetCode || item.assetId,
    name: item.assetName || item.assetCode || item.assetId,
    assetCategory: { id: "", name: "" },
    market: {
      code: "",
      name: "",
      currency: { code: item.priceCurrency || "", name: "", symbol: "" },
    },
  }
}

/** Seeds the "ask AI about this asset" popup with the row's full draft-
 * rebalance context so the model can comment on THIS proposed change rather
 * than the asset in the abstract — includes an explicit note that nothing
 * has been executed yet. */
function buildDraftRebalanceInsight(
  item: DisplayItem,
  execution: ExecutionDto,
): { query: string; context: Record<string, unknown> } {
  const assetLabel = item.assetCode || item.assetId
  const currentPriceText =
    item.snapshotPrice != null
      ? `${formatCurrency(item.snapshotPrice)} ${item.priceCurrency || ""}`.trim()
      : "unavailable"
  const afterWeightText =
    item.projectedWeight != null ? formatPercent(item.projectedWeight) : "n/a"
  const portfolioLabel =
    execution.name || execution.modelName || "Ad-hoc rebalance"

  const query = `Role: You are a concise financial analyst helping a user review a DRAFT portfolio rebalance. This rebalance is under consideration only — no transactions have been executed yet.

Analyse this single asset within the draft rebalance (150-250 words):
1. Does the proposed change (buy/sell/hold) make sense given current vs target weight?
2. Key risks or considerations specific to this trade
3. Anything notable about the size of the change relative to the position or portfolio

Portfolio: ${portfolioLabel} (portfolio id: ${execution.portfolioIds.join(", ") || "unknown"})
Asset: ${assetLabel}${item.assetName ? ` — ${item.assetName}` : ""}
Current weight: ${formatPercent(item.snapshotWeight)}
Target weight: ${formatPercent(item.effectiveTarget)}
After % (projected weight once this draft is applied): ${afterWeightText}
Delta quantity: ${item.deltaQuantity}
Delta value: ${formatSignedNumber(item.deltaValue)} ${execution.currency}
Current price: ${currentPriceText}

Note: this is a DRAFT rebalance under consideration — it has not been executed.

Style: Clear, direct, evidence-based. No filler.`

  return {
    query,
    context: {
      page: "Rebalance Execute — Asset Insight",
      description:
        "AI analysis of a single asset within a draft (unexecuted) portfolio rebalance",
      portfolioIds: execution.portfolioIds,
      assetCode: assetLabel,
      assetName: item.assetName,
      currentWeight: formatPercent(item.snapshotWeight),
      targetWeight: formatPercent(item.effectiveTarget),
      afterWeight: afterWeightText,
      deltaQuantity: item.deltaQuantity,
      deltaValue: item.deltaValue,
      currentPrice: currentPriceText,
      draft: true,
    },
  }
}

function ExecuteRebalancePage(): React.ReactElement {
  const router = useRouter()
  const {
    planId,
    portfolios,
    executionId,
    source,
    filterByModel: filterByModelParam,
    adhoc,
    currency,
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

  // Slider precision toggle for target-weight editing — pure UI state, not
  // persisted. Drives both the range input's `step` and the numeric input's
  // spinner increment; typed numeric entries still accept arbitrary 0.01
  // precision regardless of this setting.
  const [sliderStep, setSliderStep] = useState<SliderStep>(5)

  // Price-chart / AI-insight popup targets — the row the user clicked the
  // chart-line or wand-sparkles affordance on. Null closes the popup.
  const [chartTarget, setChartTarget] = useState<DisplayItem | null>(null)
  const [insightTarget, setInsightTarget] = useState<DisplayItem | null>(null)

  // Hook handles all data fetching, state, and operations
  const {
    execution,
    displayItems,
    activeItems,
    cashSummary,
    brokers,
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
    adhoc: adhoc === "1",
    currency: currency as string | undefined,
  })

  // Handle URL update after new execution creation. The executionId guard is
  // load-bearing: Pages Router rebuilds the router object every render, so an
  // unguarded shallow replace re-fires this effect on its own navigation —
  // Safari kills the tab after 100 replaceState calls in 10s (BC-VIEW-60).
  useEffect(() => {
    if (createdExecutionId && executionId !== createdExecutionId) {
      const sourceParam = source
        ? `&source=${encodeURIComponent(source as string)}`
        : ""
      router.replace(
        `/rebalance/execute?executionId=${createdExecutionId}${sourceParam}`,
        undefined,
        { shallow: true },
      )
    }
  }, [createdExecutionId, executionId, source, router])

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
        <Alert variant="error" className="max-w-4xl mx-auto">
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
        </Alert>
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
              {execution.modelName ? "Rebalance Portfolio" : "Ad-hoc Rebalance"}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {execution.modelName ? (
                <>
                  {"Using plan"}: {execution.modelName} v{execution.planVersion}
                  {execution.filterByModel && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      <i className="fas fa-filter mr-1"></i>
                      {"Model positions only"}
                    </span>
                  )}
                </>
              ) : (
                "Target weights seeded from current holdings — edit to rebalance"
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
                    onClick={handlers.setAllToZero}
                    className="px-3 py-1 text-xs text-red-600 bg-white border border-red-300 rounded hover:bg-red-50"
                    title="Set all assets to 0% (sell everything)"
                  >
                    All &rarr; 0
                  </button>
                </div>
              </div>
              {/* Slider precision toggle */}
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs text-gray-500">{"Slider step:"}</span>
                <div
                  className="inline-flex rounded-md shadow-sm"
                  role="group"
                  aria-label="Slider step precision"
                >
                  {SLIDER_STEP_OPTIONS.map((opt, idx) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSliderStep(opt.value)}
                      aria-pressed={sliderStep === opt.value}
                      className={`px-3 py-1 text-xs font-medium border ${
                        idx === 0
                          ? "rounded-l-md"
                          : idx === SLIDER_STEP_OPTIONS.length - 1
                            ? "rounded-r-md border-l-0"
                            : "border-l-0"
                      } ${
                        sliderStep === opt.value
                          ? "bg-invest-100 text-invest-700 border-invest-200"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
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
                      {"Price"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {"Current"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {"Target"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      %
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                      title={
                        cashSummary.projectedCash < 0
                          ? "Assumes required cash is funded"
                          : "Resulting weight once all target changes are applied"
                      }
                    >
                      {"After %"}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {"Quantity"}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayItems.map((item) => {
                    const isCash = item.isCash
                    // Row tinge follows deltaQuantity (not deltaValue) so a
                    // trade of any nonzero size is coloured — excluded/PRIVATE
                    // rows stay neutral regardless of a stale nonzero delta.
                    const isBuy =
                      !item.isExcluded && !isCash && item.deltaQuantity > 0
                    const isSell =
                      !item.isExcluded && !isCash && item.deltaQuantity < 0
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
                            className={`font-medium flex items-center gap-1 ${isCash ? "text-blue-900" : "text-gray-900"}`}
                            title={item.rationale || undefined}
                          >
                            {isCash && (
                              <i className="fas fa-coins mr-2 text-blue-500"></i>
                            )}
                            <span>{item.assetCode || item.assetId}</span>
                            {item.rationale && !isCash && (
                              <i
                                className="fas fa-info-circle text-gray-400 text-xs cursor-help"
                                title={item.rationale}
                              ></i>
                            )}
                            {!isCash && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setChartTarget(item)}
                                  className="text-gray-400 hover:text-invest-600 p-0.5"
                                  title="Price history chart"
                                >
                                  <i className="fas fa-chart-line text-xs"></i>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInsightTarget(item)}
                                  className="text-gray-400 hover:text-invest-600 p-0.5"
                                  title="Ask AI about this asset"
                                >
                                  <i className="fas fa-wand-magic-sparkles text-xs"></i>
                                </button>
                              </>
                            )}
                          </div>
                          {item.assetName && !isCash && (
                            <div className="text-xs text-gray-500">
                              {item.assetName}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {item.snapshotPrice != null
                            ? `${formatCurrency(item.snapshotPrice)} ${item.priceCurrency || ""}`.trim()
                            : "—"}
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
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={sliderStep}
                              value={item.effectiveTarget * 100}
                              onChange={(e) => {
                                const raw = parseFloat(e.target.value)
                                if (Number.isNaN(raw)) return
                                const snapped = snapToStep(raw, sliderStep)
                                handlers.targetChange(
                                  item.assetId,
                                  snapped / 100,
                                )
                              }}
                              disabled={item.isExcluded}
                              aria-label={`${item.assetCode || item.assetId} target weight`}
                              className="w-16 sm:w-24 min-w-[60px] h-2 accent-invest-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step={sliderStep}
                              value={(item.effectiveTarget * 100).toFixed(2)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                handlers.targetChange(item.assetId, val / 100)
                              }}
                              disabled={item.isExcluded}
                              aria-label={`${item.assetCode || item.assetId} target weight percent`}
                              className={`w-20 px-2 py-1 text-right border rounded focus:ring-invest-500 focus:border-invest-500 ${
                                isCash
                                  ? "border-blue-300 bg-blue-50"
                                  : item.isExcluded
                                    ? "border-gray-300 bg-gray-100"
                                    : "border-gray-300"
                              }`}
                            />
                          </div>
                        </td>
                        <td
                          className={`px-4 py-3 text-right ${isCash ? "text-blue-900" : "text-gray-700"}`}
                        >
                          {item.projectedWeight == null
                            ? "—"
                            : formatPercent(item.projectedWeight)}
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
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">
                      {formatPercent(
                        displayItems.reduce(
                          (sum, item) => sum + item.planTargetWeight,
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatPercent(
                        displayItems.reduce(
                          (sum, item) => sum + item.effectiveTarget,
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatPercent(
                        displayItems.reduce(
                          (sum, item) => sum + (item.projectedWeight ?? 0),
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {cashSummary.projectedCash < 0 && (
              <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-t border-amber-200">
                {
                  "After % assumes required cash is funded — the projected cash shortfall shown above is treated as a deposit."
                }
              </p>
            )}
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
                // Warn (but don't block) when the user has >1 brokers
                // and didn't tag the orders — saves a "where's the
                // broker on these trns?" follow-up later.
                if (brokers.length > 1 && !selectedBrokerId) {
                  const ok = window.confirm(
                    "No broker selected. Your proposed transactions won't be tagged with a broker. Continue?",
                  )
                  if (!ok) return
                }
                const result = await handlers.commit()
                if (!result) return
                // Only land on /trns/proposed when the orders are
                // actually unsettled. Settled commits go straight to
                // the portfolio holdings.
                if (result.transactionStatus === "PROPOSED") {
                  router.push("/trns/proposed")
                } else {
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
      {chartTarget && (
        <PriceChartPopup
          asset={toChartAsset(chartTarget)}
          portfolioId={execution.portfolioIds[0]}
          onClose={() => setChartTarget(null)}
        />
      )}
      {insightTarget && (
        <AssetInsightPopup
          asset={{
            assetId: insightTarget.assetId,
            assetCode: insightTarget.assetCode,
            assetName: insightTarget.assetName,
            weight: insightTarget.effectiveTarget * 100,
          }}
          promptOverride={buildDraftRebalanceInsight(insightTarget, execution)}
          onClose={() => setInsightTarget(null)}
        />
      )}
    </div>
  )
}

export default withPageAuthRequired(ExecuteRebalancePage)
