import React from "react"
import type { FiMetrics } from "types/independence"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import PensionGauge, { type PensionGaugeProps } from "./PensionGauge"

export interface StrategyGaugesStripProps {
  /** Live FiMetrics from the latest projection. Undefined while calculating. */
  fiMetrics?: FiMetrics
  /**
   * When true, lays out the gauges in a 2-column grid (suitable for the
   * sticky ScenarioBar). When false, stacks them vertically (suitable for
   * the Metrics tab Pension/Bridge sections).
   */
  compact?: boolean
}

/**
 * Inline strip of the four pension-saver gauges: FIRE Progress,
 * Retirement-Age FI, Income Coverage, Bridge to Pension.
 *
 * Renders a placeholder when fiMetrics is undefined so the strip keeps its
 * layout slot during projection recalculations — avoids layout shift.
 */
export default function StrategyGaugesStrip({
  fiMetrics,
  compact = false,
}: StrategyGaugesStripProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const gauges = buildGauges(fiMetrics, hideValues)

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
        "Classic FIRE: liquid investments vs 25× net annual expenses (4% safe withdrawal rate).",
      value: fiProgress,
      hideValues,
      format: (v) => `${v.toFixed(1)}%`,
    },
  ]

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
      label: "Bridge to Pension",
      tooltip:
        "Years of full expenses your liquid pot covers vs years to your pension payout age.",
      value: fi.bridgeProgress,
      hideValues,
      format: () => `${years.toFixed(1)} / ${needed}y`,
    })
  }

  return out
}
