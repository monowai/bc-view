import type { FiMetrics, HeadlineMetric } from "types/independence"

export interface HeadlineGauge {
  label: string
  /** Raw percentage value used for colour theming. */
  value: number
  /** Pre-formatted text shown next to the label (e.g. "54.0%" or "3.3 / 13y"). */
  display: string
  /** 0-100 width for progress bars (already clamped). */
  fillPercent: number
  /** Sub-caption shown below the bar in cards that want it. */
  byline: string
}

/**
 * The figures a headline gauge can feature. A phase projection carries all of
 * them in its `fiMetrics`; a journey projection only the two progress figures,
 * so its other headlines fall back to plain progress.
 */
export type HeadlineFigures = Partial<
  Pick<
    FiMetrics,
    | "fiProgress"
    | "retirementAgeFiProgress"
    | "incomeCoverageAtRetirement"
    | "bridgeProgress"
    | "bridgeYears"
    | "bridgeYearsNeeded"
  >
>

/**
 * Picks which metric to feature based on the plan's effective headline metric.
 * Falls back to Progress when the selected metric has no data.
 * Shared by the plans-list card and the Wealth tab card (IndependenceMetrics).
 *
 * The projection header renders gauges through StrategyGaugesStrip instead —
 * it takes the same `effectiveHeadlineMetric` and features the matching gauge,
 * so one plan reports one headline percentage everywhere.
 */
export function pickHeadlineGauge(
  metric: HeadlineMetric | undefined,
  fi: HeadlineFigures | undefined,
): HeadlineGauge {
  const fiProgress = fi?.fiProgress ?? 0
  const earlyRetirement: HeadlineGauge = {
    label: "Progress",
    value: fiProgress,
    display: `${fiProgress.toFixed(1)}%`,
    fillPercent: clamp(fiProgress),
    byline: "Progress toward FI Number",
  }
  if (metric === "RETIREMENT_AGE_FI" && fi?.retirementAgeFiProgress != null) {
    return {
      label: "Retirement-Age Progress",
      value: fi.retirementAgeFiProgress,
      display: `${fi.retirementAgeFiProgress.toFixed(1)}%`,
      fillPercent: clamp(fi.retirementAgeFiProgress),
      byline: "Liquid + present value of guaranteed pension income",
    }
  }
  if (metric === "INCOME_COVERAGE" && fi?.incomeCoverageAtRetirement != null) {
    return {
      label: "Income Coverage",
      value: fi.incomeCoverageAtRetirement,
      display: `${fi.incomeCoverageAtRetirement.toFixed(1)}%`,
      fillPercent: clamp(fi.incomeCoverageAtRetirement),
      byline: "Share of expenses covered by guaranteed income",
    }
  }
  if (
    metric === "BRIDGE_PROGRESS" &&
    fi?.bridgeProgress != null &&
    fi.bridgeYears != null &&
    fi.bridgeYearsNeeded != null
  ) {
    return {
      label: "Self-funded years",
      value: fi.bridgeProgress,
      display: `${fi.bridgeYears.toFixed(1)} / ${fi.bridgeYearsNeeded}y`,
      fillPercent: clamp(fi.bridgeProgress),
      byline: "Years of liquid runway to pension start age",
    }
  }
  return earlyRetirement
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, n))
}
