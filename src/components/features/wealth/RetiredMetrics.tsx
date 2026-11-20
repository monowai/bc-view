import React from "react"
import type { MonteCarloResult, RetirementProjection } from "types/independence"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import {
  type GuardrailBand,
  moneyLastsTo,
  plannedAnnualDrawdown,
  withdrawalGuardrail,
} from "@lib/independence/retiredMetrics"
import {
  MONTHS_PER_YEAR,
  type SpendSummary,
} from "@lib/independence/spendSummary"

/** One cell of the dashboard's metric row; shared with the saving-phase row. */
export const METRIC_CLS = "px-4 first:pl-0 lg:last:pr-0"
const LABEL_CLS = "text-xs font-medium text-gray-500 mb-1"
const VALUE_CLS = "text-2xl font-bold tabular-nums text-gray-900"
const NOTE_CLS = "text-xs text-gray-500 mt-2"
const MUTED_VALUE = <span className="text-2xl font-bold text-gray-400">—</span>
const HIDDEN_VALUE = (
  <span className="text-2xl font-bold text-gray-400">****</span>
)
const SIMULATING = <p className={NOTE_CLS}>Simulating…</p>
const SIMULATION_FAILED = (
  <p className="text-xs text-loss mt-2">Simulation unavailable</p>
)

const BAND_TEXT: Record<GuardrailBand, string> = {
  under: "Below plan — room to spend",
  onTrack: "On track",
  over: "Above plan — consider trimming",
  none: "No planned draw this year",
}

const BAND_CLS: Record<GuardrailBand, string> = {
  under: "text-wealth-600",
  onTrack: "text-gain",
  over: "text-loss",
  none: "text-gray-500",
}

interface RetiredMetricsProps {
  projection: RetirementProjection
  /** Net amount drawn from investments in the last 30 days. */
  drawnLastMonth: number | undefined
  /** Net amount drawn from investments in the last 12 months. */
  drawnLastYear: number | undefined
  monteCarlo: MonteCarloResult | null
  monteCarloLoading: boolean
  /** The Monte Carlo run failed. */
  monteCarloUnavailable: boolean
  currencySymbol: string
  /** Recorded monthly spend over the last 12 months; null until any is recorded. */
  spend: SpendSummary | null
  onLogSpend: () => void
  /** The spend log failed to load. */
  spendUnavailable: boolean
  /** The spend log's currency when it is not the plan's, so it cannot be compared. */
  spendOtherCurrency: string | null
}

function Bar({
  percent,
  className,
}: {
  percent: number
  className: string
}): React.ReactElement {
  return (
    <div className="mt-2 bg-gray-100 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all ${className}`}
        style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
      />
    </div>
  )
}

/**
 * Drawdown-phase cards for a plan owner past retirement age: how fast the
 * pot is being drawn, against plan, and how long it lasts.
 */
export default function RetiredMetrics({
  projection,
  drawnLastMonth,
  drawnLastYear,
  monteCarlo,
  monteCarloLoading,
  monteCarloUnavailable,
  currencySymbol,
  spend,
  onLogSpend,
  spendUnavailable,
  spendOtherCurrency,
}: RetiredMetricsProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const money = (n: number): string =>
    `${currencySymbol}${Math.round(n).toLocaleString()}`

  const planned = plannedAnnualDrawdown(projection)
  // Recorded spend, when there is any, says more than investment sales.
  const annualDraw = spend ? spend.annualDraw : drawnLastYear
  const guardrail =
    annualDraw === undefined
      ? null
      : withdrawalGuardrail(annualDraw, planned, projection.liquidAssets)
  const lastsTo = monteCarlo ? moneyLastsTo(monteCarlo.yearlyBands) : null
  const simulationNote = monteCarloLoading
    ? SIMULATING
    : monteCarloUnavailable && SIMULATION_FAILED
  const lifeExpectancy = projection.planInputs?.lifeExpectancy
  const beyondPlan = lifeExpectancy ? `${lifeExpectancy}+` : "Lasts the plan"

  return (
    <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-gray-100">
      <div className={METRIC_CLS}>
        <p className={LABEL_CLS}>Withdrawal Rate</p>
        {hideValues ? (
          HIDDEN_VALUE
        ) : guardrail ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className={VALUE_CLS}>
                {guardrail.actualRate.toFixed(1)}%
              </span>
              <span className="text-sm text-gray-500">
                plan {guardrail.plannedRate.toFixed(1)}%
              </span>
            </div>
            <p
              className={`text-xs font-medium mt-2 ${BAND_CLS[guardrail.band]}`}
            >
              {BAND_TEXT[guardrail.band]}
            </p>
            <p className="text-xs text-gray-400">
              {spend
                ? "From recorded spend, share of liquid assets"
                : "Last 12 months, share of liquid assets"}
            </p>
          </>
        ) : (
          MUTED_VALUE
        )}
      </div>

      <div className={METRIC_CLS}>
        <div className="flex items-baseline justify-between">
          <p className={LABEL_CLS}>
            {spend ? "Spend vs Budget" : "Drawn vs Plan"}
          </p>
          <button
            type="button"
            onClick={onLogSpend}
            className="rounded-sm text-xs text-wealth-600 hover:text-wealth-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"
          >
            Log spend
          </button>
        </div>
        {spendUnavailable && !hideValues && (
          <p className="text-xs text-loss mb-1">
            Spend log unavailable — showing investment sales
          </p>
        )}
        {spendOtherCurrency && !hideValues && (
          <p className="text-xs text-gray-500 mb-1">
            Spend is logged in {spendOtherCurrency} — showing investment sales
          </p>
        )}
        {hideValues ? (
          HIDDEN_VALUE
        ) : spend ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className={VALUE_CLS}>{money(spend.actual)}</span>
              <span className="text-sm text-gray-500">
                / {money(spend.budget)}
              </span>
            </div>
            <Bar
              percent={
                spend.budget > 0 ? (spend.actual / spend.budget) * 100 : 0
              }
              className={
                spend.actual > spend.budget ? "bg-loss" : "bg-independence-500"
              }
            />
            <p className={NOTE_CLS}>
              {spend.monthsEntered === 1
                ? "1 month recorded"
                : `${spend.monthsEntered} months recorded`}
              {spend.monthsEstimated > 0 &&
                ` (${spend.monthsEstimated} estimated)`}
            </p>
          </>
        ) : drawnLastYear === undefined ? (
          MUTED_VALUE
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className={VALUE_CLS}>{money(drawnLastYear)}</span>
              <span className="text-sm text-gray-500">/ {money(planned)}</span>
            </div>
            <Bar
              percent={planned > 0 ? (drawnLastYear / planned) * 100 : 0}
              className={
                guardrail?.band === "over" ? "bg-loss" : "bg-independence-500"
              }
            />
            {drawnLastMonth !== undefined && (
              <p className={NOTE_CLS}>
                Last 30 days: {money(drawnLastMonth)} of{" "}
                {money(planned / MONTHS_PER_YEAR)}
              </p>
            )}
          </>
        )}
      </div>

      <div className={METRIC_CLS}>
        <p className={LABEL_CLS}>Plan Success</p>
        {hideValues ? (
          HIDDEN_VALUE
        ) : monteCarlo ? (
          <>
            <span className={VALUE_CLS}>
              {Math.round(monteCarlo.successRate)}%
            </span>
            <Bar percent={monteCarlo.successRate} className="bg-gain" />
            <p className={NOTE_CLS}>Simulated markets where the money lasts</p>
          </>
        ) : (
          <>
            {MUTED_VALUE}
            {simulationNote}
          </>
        )}
      </div>

      <div className={METRIC_CLS}>
        <p className={LABEL_CLS}>Money Lasts To</p>
        {hideValues ? (
          HIDDEN_VALUE
        ) : lastsTo ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className={VALUE_CLS}>{lastsTo.median ?? beyondPlan}</span>
              {lastsTo.median != null && (
                <span className="text-sm text-gray-500">years old</span>
              )}
            </div>
            <p className={NOTE_CLS}>
              Bad case (bottom 10%):{" "}
              {lastsTo.badCase != null
                ? `age ${lastsTo.badCase}`
                : "lasts the plan"}
            </p>
          </>
        ) : (
          <>
            {MUTED_VALUE}
            {simulationNote}
          </>
        )}
      </div>
    </div>
  )
}
