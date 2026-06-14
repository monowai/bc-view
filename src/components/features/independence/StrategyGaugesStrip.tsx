import React from "react"
import type { FiMetrics } from "types/independence"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import PensionGauge, { type PensionGaugeProps } from "./PensionGauge"
import type { StrategyView } from "./strategyView"

export interface StrategyGaugesStripProps {
  /** Live FiMetrics from the latest projection. Undefined while calculating. */
  fiMetrics?: FiMetrics
  /**
   * When true, lays out the gauges in a 2-column grid (suitable for the
   * sticky ScenarioBar). When false, stacks them vertically (suitable for
   * the Metrics tab Pension/Self-funded sections).
   */
  compact?: boolean
  /**
   * Active strategy view. Promotes the matching gauge to the headline slot
   * (first position). "ALL" falls back to FIRE for the headline.
   */
  view?: StrategyView
  /**
   * When true, renders only the headline gauge (single bar) instead of the
   * full strip. Used by the sticky ScenarioBar so the header stays compact.
   */
  singleHeadline?: boolean
}

/**
 * Inline strip of the four pension-saver gauges: FIRE Progress,
 * Retirement-Age FI, Income Coverage, Self-funded years.
 *
 * Renders a placeholder when fiMetrics is undefined so the strip keeps its
 * layout slot during projection recalculations — avoids layout shift.
 */
export default function StrategyGaugesStrip({
  fiMetrics,
  compact = false,
  view = "ALL",
  singleHeadline = false,
}: StrategyGaugesStripProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const ordered = orderGauges(buildGauges(fiMetrics, hideValues), view)
  const gauges = singleHeadline ? ordered.slice(0, 1) : ordered

  const containerClass = compact
    ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
    : "space-y-3"

  return (
    <div className={containerClass}>
      {gauges.map(({ key, ...rest }) => (
        <PensionGauge key={key} {...rest} />
      ))}
    </div>
  )
}

/** Maps a strategy view to the gauge key that should sit in the headline slot. */
const VIEW_HEADLINE_KEY: Record<StrategyView, string> = {
  FIRE: "fire",
  PENSION: "retirement-age-fi",
  HYBRID: "bridge",
  // ALL has no "single most relevant" gauge; fall through to FIRE.
  ALL: "fire",
}

/**
 * Promotes the view-matching gauge to position 0 so it stays visible if
 * the strip is truncated. When view = ALL, returns gauges in their
 * natural order.
 */
function orderGauges(
  gauges: PensionGaugeProps[],
  view: StrategyView,
): PensionGaugeProps[] {
  const headlineKey = VIEW_HEADLINE_KEY[view]
  const headline = gauges.find((g) => g.key === headlineKey)
  if (!headline) return gauges
  const rest = gauges.filter((g) => g.key !== headlineKey)
  return [headline, ...rest]
}

function buildGauges(
  fi: FiMetrics | undefined,
  hideValues: boolean,
): PensionGaugeProps[] {
  const fiProgress = fi?.fiProgress ?? 0
  const out: PensionGaugeProps[] = [
    {
      key: "fire",
      label: "FIRE Progress",
      tooltip:
        "Classic FIRE: liquid investments vs 25× net annual expenses (4% safe withdrawal rate). A snapshot of today's assets — not affected by return or inflation assumptions (those drive the on-track verdict and the My Path chart).",
      value: fiProgress,
      hideValues,
      format: (v) => `${v.toFixed(1)}%`,
    },
  ]

  // Always emit the retirement-age-fi gauge so the PENSION view headline
  // slot has the right LABEL even before pension income is configured
  // (e.g., CPF LIFE not yet set up). Without this the picker falls
  // through to "FIRE Progress" on pension-strategy plans and the headline
  // reads as a FIRE metric instead of a pension metric. Use coastFiProgress
  // as the most-informative pension-strategy fallback when retirement-age
  // FI is unavailable.
  if (fi?.retirementAgeFiProgress != null) {
    out.push({
      key: "retirement-age-fi",
      label: "Retirement-Age FI",
      tooltip:
        "Liquid plus the present value of your guaranteed pension income, compared to your FI Number.",
      value: fi.retirementAgeFiProgress,
      hideValues,
      format: (v) => `${v.toFixed(1)}%`,
    })
  } else if (fi?.coastFiProgress != null) {
    out.push({
      key: "retirement-age-fi",
      label: "Coast FI Progress",
      tooltip:
        "On-track signal for pension-strategy plans without configured guaranteed income. Compares current liquid assets to the amount that would compound to your FI Number by retirement age.",
      value: fi.coastFiProgress,
      hideValues,
      format: (v) => `${v.toFixed(1)}%`,
    })
  }

  if (fi?.incomeCoverageAtRetirement != null) {
    out.push({
      key: "income-coverage",
      label: "Income Coverage",
      tooltip:
        "Share of monthly expenses covered by guaranteed income (pension, social security, other) at retirement age.",
      value: fi.incomeCoverageAtRetirement,
      hideValues,
      format: (v) => `${v.toFixed(1)}%`,
    })
  }

  if (
    fi?.bridgeProgress != null &&
    fi.bridgeYears != null &&
    fi.bridgeYearsNeeded != null
  ) {
    const years = fi.bridgeYears
    const needed = fi.bridgeYearsNeeded
    out.push({
      key: "bridge",
      label: "Self-funded years",
      tooltip:
        "Years of full expenses your liquid pot covers vs years to your pension payout age.",
      value: fi.bridgeProgress,
      hideValues,
      format: () => `${years.toFixed(1)} / ${needed}y`,
    })
  }

  return out
}
