import React, { useState, useMemo, useEffect, useRef, useCallback } from "react"
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
import { setPageContext } from "@components/features/chat/pageContextBus"
import {
  useRebalanceExecution,
  DisplayItem,
  CashSummary,
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

/** How far the slider's range extends either side of its anchor (the row's
 * target value as of the last completed edit gesture) — see the "Slider
 * anchor" state block in the page component for the full re-anchoring
 * design. Bounds are then clamped into [0, 100], so the window can be
 * asymmetric near the floor/ceiling (anchor 5 -> range 0-15, not -5-15). */
const DELTA_RANGE_PP = 10

/** Quiet period after the last keyboard/arrow-driven slider change before
 * the slider re-anchors. Long enough that a burst of arrow-key presses
 * doesn't shift the range out from under the user mid-adjustment; short
 * enough that the range settles promptly once they stop. Drag gestures
 * re-anchor immediately on pointer-up instead of waiting on this timer. */
const REANCHOR_DEBOUNCE_MS = 400

/** Deltas at or under this magnitude (percentage points) are treated as
 * exactly zero for label color, label text, and slider centering. The
 * seeded `effectiveTarget` is derived from a proportional-scaling formula
 * (planTargetWeight / totalPlanTargetWeights * availableForAssets) that is
 * mathematically equal to `snapshotWeight` on an unedited landing but lands
 * a hair off it in floating point (residuals around 1e-9–1e-13 pp) — that
 * noise must not flip the sign-based color/label. A genuine edit is at
 * least an order of magnitude larger than this threshold. */
const DELTA_EPSILON_PP = 0.005

/** Snaps a delta whose magnitude is float noise (below DELTA_EPSILON_PP) to
 * exactly zero, so every consumer — label color, label text, and slider
 * centering — agrees on "unchanged" from a single source. */
function snapEpsilonZero(deltaPct: number): number {
  return Math.abs(deltaPct) < DELTA_EPSILON_PP ? 0 : deltaPct
}

/** Rounds half-away-from-zero to `fractionDigits`, correcting for cases
 * where native `toFixed` under-rounds a value due to its binary
 * floating-point representation (e.g. (24.15).toFixed(1) === "24.1", not
 * the expected "24.2", because the nearest double to the literal 24.15 is
 * actually ~24.149999999999998579). The small additive epsilon is far
 * larger than that representation error but far smaller than the display
 * precision, so it only ever nudges genuine half-way values. */
function roundHalfUp(value: number, fractionDigits: number): number {
  const factor = 10 ** fractionDigits
  const sign = value < 0 ? -1 : 1
  return (sign * Math.round(Math.abs(value) * factor + 1e-9)) / factor
}

/** Formats a percentage-point delta with an explicit "+" for positive values
 * (negative values already carry their sign from `toFixed`; zero gets no
 * sign). `fractionDigits` controls precision — 2 when the 0.01% slider step
 * is active, 1 otherwise for the visible label; 0 for the terser
 * `aria-valuetext`. */
function formatSignedPp(value: number, fractionDigits: number): string {
  const rounded = roundHalfUp(value, fractionDigits)
  const sign = rounded > 0 ? "+" : ""
  return `${sign}${rounded.toFixed(fractionDigits)}`
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

/** A row counts as "changed" for the draft-context summary when it's been
 * excluded, or its target has moved off the row's current weight by more
 * than float noise. Mirrors the epsilon rule the table itself uses for
 * delta-label coloring, so the FAB's notion of "changed" matches what's
 * visually tinted on screen. */
function isRowChanged(item: DisplayItem): boolean {
  if (item.isCash) return false
  if (item.isExcluded) return true
  return (
    snapEpsilonZero(item.effectiveTarget * 100 - item.snapshotWeight * 100) !==
    0
  )
}

/**
 * Compact plain-text summary of the current (client-only, unsaved-included)
 * draft rebalance state — published to the global Chat FAB via
 * `pageContextBus` so "what am I looking at" / "does this make sense"
 * questions are answered against what's actually on screen, not the
 * last-saved server snapshot. Only *changed* rows are itemised (unchanged
 * rows are just counted) so the block stays small regardless of portfolio
 * size — cheap enough to rebuild on every edit.
 */
export function buildDraftContext(
  execution: ExecutionDto,
  displayItems: DisplayItem[],
  cashSummary: CashSummary,
): string {
  const nonCashItems = displayItems.filter((item) => !item.isCash)
  const changed = nonCashItems.filter(isRowChanged)
  const unchangedCount = nonCashItems.length - changed.length

  const portfolioLabel = execution.name || execution.modelName || "Ad-hoc"
  const lines: string[] = [
    "DRAFT portfolio rebalance under consideration — nothing has been executed yet.",
    `Execution: ${execution.id} (${execution.mode}${
      execution.modelName ? `, model ${execution.modelName}` : ""
    })`,
    `Portfolio: ${portfolioLabel} (${execution.portfolioIds.join(", ") || "unknown"})`,
    `Changed rows (${changed.length}):`,
  ]

  if (changed.length === 0) {
    lines.push("- none yet — all targets still match current holdings")
  } else {
    for (const item of changed) {
      const code = item.assetCode || item.assetId
      if (item.isExcluded) {
        lines.push(
          `- ${code}: excluded from execution — held at current ${formatPercent(item.snapshotWeight)}`,
        )
        continue
      }
      const afterText =
        item.projectedWeight != null
          ? formatPercent(item.projectedWeight)
          : "n/a"
      lines.push(
        `- ${code}: ${formatPercent(item.snapshotWeight)} -> ${formatPercent(item.effectiveTarget)} target (after ${afterText}), ` +
          `qty ${item.deltaQuantity > 0 ? "+" : ""}${item.deltaQuantity}, value ${formatSignedNumber(item.deltaValue)} ${execution.currency}`,
      )
    }
  }

  lines.push(`Unchanged rows: ${unchangedCount}`)
  lines.push(
    `Cash: net impact ${formatSignedNumber(cashSummary.netImpact)} ${execution.currency}, ` +
      `projected cash ${formatCurrency(cashSummary.projectedCash)} ${execution.currency}` +
      (cashSummary.projectedCash < 0
        ? " — DEPOSIT REQUIRED to fund this draft"
        : ""),
  )

  return lines.join("\n")
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

  // --- Slider anchor state ---
  //
  // Per-assetId "anchor" (percent, 0-100) each row's slider range is
  // centered on: min = max(0, anchor-10), max = min(100, anchor+10). Chosen
  // to live in the PAGE (not the hook) — it's pure input-widget presentation
  // state with no bearing on save/refresh/commit payloads, same footing as
  // `sliderStep` just above.
  //
  // At rest, anchor === the row's current target (no explicit entry falls
  // back to `item.effectiveTarget * 100` below). A stored entry only
  // diverges from the live target mid-drag, where it must stay FIXED so the
  // range doesn't shift under the user's thumb — re-anchoring happens on
  // gesture-complete: pointer-up for drag, blur/400ms-debounce for
  // keyboard/arrows, immediately for a numeric-input commit.
  const [sliderAnchors, setSliderAnchors] = useState<Record<string, number>>({})
  const draggingRef = useRef<Record<string, boolean>>({})
  const debounceTimersRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({})

  const reanchor = useCallback((assetId: string, pct: number): void => {
    setSliderAnchors((prev) => ({ ...prev, [assetId]: pct }))
  }, [])

  const clearAnchor = useCallback((assetId: string): void => {
    setSliderAnchors((prev) => {
      if (!(assetId in prev)) return prev
      const next = { ...prev }
      delete next[assetId]
      return next
    })
  }, [])

  const scheduleReanchor = useCallback(
    (assetId: string, pct: number): void => {
      const timers = debounceTimersRef.current
      if (timers[assetId]) clearTimeout(timers[assetId])
      timers[assetId] = setTimeout(() => {
        reanchor(assetId, pct)
        delete timers[assetId]
      }, REANCHOR_DEBOUNCE_MS)
    },
    [reanchor],
  )

  // Any full data round-trip (load/create/save/refresh) replaces `execution`
  // with a new object — a clean signal to drop all anchors and let every
  // row re-derive from its (possibly server-reset) target on next render.
  //
  // The functional-update + "return prev when already empty" guard is
  // load-bearing, not style: a bare `setSliderAnchors({})` hands React a
  // fresh object literal every time this effect fires — including on
  // mount, when there's nothing to clear — and a *different reference* is
  // always a real state change to React (no structural comparison), so it
  // schedules a re-render even though nothing observable changed. Pages
  // Router rebuilds its router object on every render (see the URL-update
  // effect below), so that extra, otherwise-harmless re-render was enough
  // to re-fire `router.replace` a second time — the exact replaceState-loop
  // shape as BC-VIEW-60.
  useEffect(() => {
    // Reacting to an external system's identity change (`execution`, from
    // the data-fetching hook) — not derivable in render. The no-op guard
    // (return `prev` unchanged when already empty) is what keeps this from
    // cascading; see the block comment above for why that guard matters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSliderAnchors((prev) => (Object.keys(prev).length === 0 ? prev : {}))
  }, [execution])

  // Flush pending debounce timers on unmount so no `setState` fires after
  // the page has gone away.
  useEffect(() => {
    const timers = debounceTimersRef.current
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t))
    }
  }, [])

  // --- Select-all (include/exclude column header) ---
  const selectAllRef = useRef<HTMLInputElement>(null)
  const eligibleItems = useMemo(
    () => displayItems.filter((item) => !item.isCash && !item.locked),
    [displayItems],
  )
  const eligibleIncludedCount = eligibleItems.filter(
    (item) => !item.isExcluded,
  ).length
  const allIncluded =
    eligibleItems.length > 0 && eligibleIncludedCount === eligibleItems.length
  const someIncluded = eligibleIncludedCount > 0
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someIncluded && !allIncluded
    }
  }, [someIncluded, allIncluded])

  // --- Live draft context for the global Chat FAB (pageContextBus) ---
  const draftContext = useMemo(
    () =>
      execution
        ? buildDraftContext(execution, displayItems, cashSummary)
        : null,
    [execution, displayItems, cashSummary],
  )
  useEffect(() => {
    setPageContext(draftContext)
  }, [draftContext])
  // Clear on unmount only — ChatFab persists across navigation in `_app`,
  // so a page that never clears leaks its context into the next page.
  useEffect(() => {
    return () => setPageContext(null)
  }, [])

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

  // Ad-hoc executions have no model/plan behind them — target weights are
  // seeded from current holdings, so model-derived controls (All -> Target,
  // which would be a no-op duplicate of All -> Current) are noise.
  const isAdHoc = execution.mode === "AD_HOC"

  // CASH row's delta/value cell mirrors this exactly (Change 1) — never
  // recomputed from the row's own deltaValue, which only reflects cash's own
  // target-vs-snapshot and drifts from the true net cash impact once other
  // rows are edited.
  const cashDeltaClass =
    cashSummary.netImpact >= 0
      ? "text-green-700 font-medium"
      : "text-red-700 font-medium"

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
            cashFromSales={cashSummary.cashFromSales}
            cashForPurchases={cashSummary.cashForPurchases}
            netImpact={cashSummary.netImpact}
            projectedCash={cashSummary.projectedCash}
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
                    {isAdHoc
                      ? "Adjust target weights; excluded rows keep their current weight."
                      : "Edit target % to adjust allocations. Exclude positions to maintain their current weight."}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isAdHoc ? (
                    <button
                      onClick={() => {
                        handlers.setAllToCurrent()
                        setSliderAnchors({})
                      }}
                      className="px-3 py-1 text-xs text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                      title="Reset all target weights to current holdings"
                    >
                      {"Reset"}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          handlers.setAllToCurrent()
                          setSliderAnchors({})
                        }}
                        className="px-3 py-1 text-xs text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                        title="Set all % to current weights (no changes)"
                      >
                        All &rarr; Current
                      </button>
                      <button
                        onClick={() => {
                          handlers.setAllToTarget()
                          setSliderAnchors({})
                        }}
                        className="px-3 py-1 text-xs text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                        title="Reset all to target weights from model"
                      >
                        All &rarr; Target
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      handlers.setAllToZero()
                      setSliderAnchors({})
                    }}
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
            <div className="overflow-auto max-h-[65vh]">
              <table className="min-w-full table-fixed divide-y divide-gray-200">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-44" />
                  <col className="w-24" />
                  <col className="w-28" />
                  <col className="w-56" />
                  <col className="w-20" />
                  <col className="w-32" />
                </colgroup>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="sticky top-0 z-20 bg-gray-50 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allIncluded}
                        onChange={() => handlers.setIncludeAll(!allIncluded)}
                        disabled={eligibleItems.length === 0}
                        aria-label="Include all"
                        title="Include/exclude all eligible rows"
                        className="h-4 w-4 text-gray-600 rounded border-gray-300 focus:ring-gray-500 disabled:opacity-40"
                      />
                    </th>
                    <th className="sticky top-0 left-0 z-30 bg-gray-50 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      {"Asset"}
                    </th>
                    <th className="sticky top-0 z-20 bg-gray-50 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      {"Price"}
                    </th>
                    <th className="sticky top-0 z-20 bg-gray-50 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      {"Current"}
                    </th>
                    <th className="sticky top-0 z-20 bg-gray-50 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      {"Target"}
                    </th>
                    <th
                      className="sticky top-0 z-20 bg-gray-50 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                      title={
                        cashSummary.projectedCash < 0
                          ? "Assumes required cash is funded"
                          : "Resulting weight once all target changes are applied"
                      }
                    >
                      {"After %"}
                    </th>
                    <th className="sticky top-0 z-20 bg-gray-50 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      {"Trade"}
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
                    // The sticky Asset cell paints above the rest of the row
                    // once horizontally scrolled — it needs its own opaque
                    // background matching the row tint, or content scrolled
                    // underneath shows through.
                    const stickyAssetBg = isCash
                      ? "bg-blue-50"
                      : item.isExcluded
                        ? "bg-gray-100"
                        : isBuy
                          ? "bg-green-50"
                          : isSell
                            ? "bg-red-50"
                            : "bg-white"

                    // Slider semantics: the range now tracks an absolute
                    // target percent, windowed to +-DELTA_RANGE_PP either
                    // side of the row's "anchor" (see the anchor state block
                    // above the early returns) — re-anchored on gesture-
                    // complete rather than pinned to the current weight.
                    const targetPct = item.effectiveTarget * 100
                    const originalPct = item.originalTarget * 100

                    const anchorPct = sliderAnchors[item.assetId] ?? targetPct
                    const sliderMin = Math.max(0, anchorPct - DELTA_RANGE_PP)
                    const sliderMax = Math.min(100, anchorPct + DELTA_RANGE_PP)
                    // Rounded to 2dp — `targetPct` inherits the same
                    // proportional-scaling float noise documented on
                    // DELTA_EPSILON_PP above (residuals around 1e-9–1e-13
                    // pp). The delta label already snaps that noise to zero;
                    // the slider's raw `value` attribute needs its own
                    // rounding since it renders `targetPct` directly rather
                    // than through a comparison.
                    const sliderValue =
                      Math.round(
                        Math.min(sliderMax, Math.max(sliderMin, targetPct)) *
                          100,
                      ) / 100

                    // Delta-vs-ORIGINAL (not vs current) drives the Trade
                    // column's pp label — the cumulative, meaningful number
                    // once a row's been edited more than once in the
                    // session. Excluded rows keep their current weight
                    // regardless of any stale effectiveTarget, so they never
                    // show a delta.
                    const deltaVsOriginalPct = item.isExcluded
                      ? 0
                      : snapEpsilonZero(targetPct - originalPct)
                    const deltaLabelClass =
                      deltaVsOriginalPct === 0
                        ? "text-gray-500"
                        : deltaVsOriginalPct > 0
                          ? "text-green-600"
                          : "text-red-600"

                    // Per-row reset (Change 3) is only actionable once the
                    // target has actually moved off its seeded original —
                    // independent of exclusion, which is a separate control.
                    const targetChangedFromOriginal =
                      snapEpsilonZero(targetPct - originalPct) !== 0

                    return (
                      <tr key={item.assetId} className={rowClass}>
                        <td className="px-2 py-2 text-center">
                          {!isCash && (
                            <input
                              type="checkbox"
                              checked={item.isExcluded}
                              disabled={item.locked}
                              onChange={() =>
                                handlers.excludeToggle(item.assetId)
                              }
                              className="h-4 w-4 text-gray-600 rounded border-gray-300 focus:ring-gray-500 disabled:opacity-40"
                              title={
                                item.locked
                                  ? "Locked — not eligible for execution"
                                  : item.isExcluded
                                    ? "Include in execution"
                                    : "Exclude from execution"
                              }
                            />
                          )}
                        </td>
                        <td
                          className={`sticky left-0 z-10 px-3 py-2 ${stickyAssetBg}`}
                        >
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
                            <div className="text-xs text-gray-500 truncate">
                              {item.assetName}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700 tabular-nums">
                          {item.snapshotPrice != null
                            ? `${formatCurrency(item.snapshotPrice)} ${item.priceCurrency || ""}`.trim()
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <button
                            type="button"
                            onClick={() => {
                              handlers.setToCurrent(
                                item.assetId,
                                item.snapshotWeight,
                              )
                              clearAnchor(item.assetId)
                            }}
                            title="Set target to current weight"
                            className={`block w-full text-right hover:underline ${
                              isCash ? "text-blue-900" : "text-gray-900"
                            }`}
                          >
                            {formatPercent(item.snapshotWeight)}
                          </button>
                          <div
                            className={`text-xs ${isCash ? "text-blue-600" : "text-gray-500"}`}
                          >
                            {formatCurrency(item.snapshotValue)}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <div className="relative w-14 sm:w-20 min-w-[56px]">
                              <input
                                type="range"
                                min={sliderMin}
                                max={sliderMax}
                                step={sliderStep}
                                value={sliderValue}
                                onPointerDown={() => {
                                  draggingRef.current[item.assetId] = true
                                  // Explicitly pin the anchor to the
                                  // pre-drag target. Without this, the
                                  // no-explicit-anchor fallback below
                                  // (`sliderAnchors[id] ?? targetPct`) would
                                  // keep tracking the LIVE target on every
                                  // drag tick — sliding the range under the
                                  // thumb instead of holding it fixed.
                                  reanchor(item.assetId, targetPct)
                                }}
                                onPointerUp={(e) => {
                                  draggingRef.current[item.assetId] = false
                                  const val = Math.min(
                                    100,
                                    Math.max(
                                      0,
                                      (e.target as HTMLInputElement)
                                        .valueAsNumber,
                                    ),
                                  )
                                  reanchor(item.assetId, val)
                                }}
                                onPointerCancel={() => {
                                  draggingRef.current[item.assetId] = false
                                }}
                                onChange={(e) => {
                                  const raw = parseFloat(e.target.value)
                                  if (Number.isNaN(raw)) return
                                  const snapped = snapToStep(raw, sliderStep)
                                  const clamped = Math.min(
                                    100,
                                    Math.max(0, snapped),
                                  )
                                  if (!draggingRef.current[item.assetId]) {
                                    // Keyboard/arrow path: pin the anchor to
                                    // where it was BEFORE this keystroke (so
                                    // the range doesn't jump on every press
                                    // while we wait out the debounce below) —
                                    // only on the first press of a burst;
                                    // once pinned, later presses in the same
                                    // burst leave it alone.
                                    if (
                                      sliderAnchors[item.assetId] === undefined
                                    ) {
                                      reanchor(item.assetId, anchorPct)
                                    }
                                  }
                                  handlers.targetChange(
                                    item.assetId,
                                    clamped / 100,
                                  )
                                  // Drag gestures re-anchor on pointer-up
                                  // above; this path is the keyboard/arrow
                                  // case, which debounces instead so a burst
                                  // of key presses doesn't shift the range
                                  // mid-adjustment.
                                  if (!draggingRef.current[item.assetId]) {
                                    scheduleReanchor(item.assetId, clamped)
                                  }
                                }}
                                onBlur={(e) => {
                                  const timers = debounceTimersRef.current
                                  if (timers[item.assetId]) {
                                    clearTimeout(timers[item.assetId])
                                    delete timers[item.assetId]
                                  }
                                  const val = Math.min(
                                    100,
                                    Math.max(
                                      0,
                                      (e.target as HTMLInputElement)
                                        .valueAsNumber,
                                    ),
                                  )
                                  reanchor(item.assetId, val)
                                }}
                                disabled={item.isExcluded}
                                aria-label={`${item.assetCode || item.assetId} target weight`}
                                aria-valuetext={`${formatPercent(item.effectiveTarget)} target (${formatSignedPp(deltaVsOriginalPct, 0)}pp vs original)`}
                                className="relative z-10 w-full h-2 accent-invest-500 disabled:opacity-40 disabled:cursor-not-allowed"
                              />
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step={sliderStep}
                              value={(item.effectiveTarget * 100).toFixed(2)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                handlers.targetChange(item.assetId, val / 100)
                                // Numeric entry re-anchors immediately — the
                                // user just told us exactly where they want
                                // to be, so the +-10pp window should follow.
                                reanchor(item.assetId, val)
                              }}
                              disabled={item.isExcluded}
                              aria-label={`${item.assetCode || item.assetId} target weight percent`}
                              className={`w-16 px-1.5 py-1 text-right text-sm border rounded focus:ring-invest-500 focus:border-invest-500 tabular-nums ${
                                isCash
                                  ? "border-blue-300 bg-blue-50"
                                  : item.isExcluded
                                    ? "border-gray-300 bg-gray-100"
                                    : "border-gray-300"
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                handlers.resetTarget(item.assetId)
                                clearAnchor(item.assetId)
                              }}
                              disabled={!targetChangedFromOriginal}
                              title="Reset to original weight"
                              aria-label={`Reset ${item.assetCode || item.assetId} weight`}
                              className="text-gray-400 hover:text-invest-600 disabled:opacity-0 disabled:pointer-events-none p-0.5"
                            >
                              <i className="fas fa-rotate-left text-xs"></i>
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              handlers.setToTarget(item.assetId)
                              clearAnchor(item.assetId)
                            }}
                            title="Reset target to plan weight"
                            className="block w-full text-right text-[11px] text-gray-400 hover:text-invest-600 hover:underline mt-0.5"
                          >
                            {"Plan"}: {formatPercent(item.planTargetWeight)}
                          </button>
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums ${isCash ? "text-blue-900" : "text-gray-700"}`}
                        >
                          {item.projectedWeight == null
                            ? "—"
                            : formatPercent(item.projectedWeight)}
                          {isCash && cashSummary.projectedCash < 0 && (
                            <div className="text-[11px] text-red-600 font-medium">
                              {"Deposit"}{" "}
                              {formatCurrency(
                                Math.abs(cashSummary.projectedCash),
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {isCash ? (
                            <>
                              <span className={cashDeltaClass}>
                                {formatSignedNumber(cashSummary.netImpact)}
                              </span>
                              <div className={`text-[11px] ${deltaLabelClass}`}>
                                {formatSignedPp(
                                  deltaVsOriginalPct,
                                  sliderStep === 0.01 ? 2 : 1,
                                )}
                              </div>
                            </>
                          ) : item.isExcluded ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <>
                              <div className={quantityClass}>
                                {item.deltaQuantity > 0 ? "+" : ""}
                                {item.deltaQuantity}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatSignedNumber(item.deltaValue)}
                              </div>
                              <div className={`text-[11px] ${deltaLabelClass}`}>
                                {formatSignedPp(
                                  deltaVsOriginalPct,
                                  sliderStep === 0.01 ? 2 : 1,
                                )}
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-2 py-2"></td>
                    <td className="sticky left-0 z-10 bg-gray-100 px-3 py-2 font-semibold text-gray-900">
                      {"Total"}
                    </td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular-nums">
                      {formatPercent(
                        displayItems.reduce(
                          (sum, item) => sum + item.effectiveTarget,
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular-nums">
                      {formatPercent(
                        displayItems.reduce(
                          (sum, item) => sum + (item.projectedWeight ?? 0),
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-3 py-2"></td>
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
              cashFromSales={cashSummary.cashFromSales}
              cashForPurchases={cashSummary.cashForPurchases}
              netImpact={cashSummary.netImpact}
              projectedCash={cashSummary.projectedCash}
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
