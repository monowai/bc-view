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
 * Picks which metric to feature based on the plan's effective headline metric.
 * Falls back to Early Retirement Progress when the selected metric has no data.
 * Shared by the projection header (FiSummaryBar) and the Wealth tab card
 * (IndependenceMetrics) so both stay in sync.
 */
export function pickHeadlineGauge(
  metric: HeadlineMetric | undefined,
  fi: FiMetrics | undefined,
): HeadlineGauge {
  const fiProgress = fi?.fiProgress ?? 0
  const earlyRetirement: HeadlineGauge = {
    label: "Early Retirement Progress",
    value: fiProgress,
    display: `${fiProgress.toFixed(1)}%`,
    fillPercent: clamp(fiProgress),
    byline: "Progress toward FI Number",
  }
  if (metric === "RETIREMENT_AGE_FI" && fi?.retirementAgeFiProgress != null) {
    return {
      label: "Retirement-Age FI",
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
