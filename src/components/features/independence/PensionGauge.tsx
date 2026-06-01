import React from "react"
import InfoTooltip from "@components/ui/Tooltip"
import { HIDDEN_VALUE } from "@components/ui/PrivateCurrency"
import {
  getProgressBgColor,
  getProgressTextColor,
} from "@utils/independence/fiColorThemes"

export interface PensionGaugeProps {
  /** Stable identifier used for React list keys; not consumed by the renderer. */
  key: string
  label: string
  tooltip: string
  value: number
  hideValues: boolean
  format: (value: number) => string
}

export type PensionGaugeRenderProps = Omit<PensionGaugeProps, "key">

/**
 * Single labelled progress bar used to render a strategy gauge (FIRE,
 * Retirement-Age FI, Bridge, Income Coverage). Shared between FiMetrics on
 * the Metrics tab and StrategyGaugesStrip in the sticky ScenarioBar.
 */
export default function PensionGauge({
  label,
  tooltip,
  value,
  hideValues,
  format,
}: PensionGaugeRenderProps): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <InfoTooltip text={tooltip}>
          <span className="text-sm text-gray-600">{label}</span>
        </InfoTooltip>
        <span
          className={`text-sm font-semibold ${getProgressTextColor(value)}`}
        >
          {hideValues ? HIDDEN_VALUE : format(value)}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getProgressBgColor(value)} transition-all duration-500`}
          style={{ width: hideValues ? "0%" : `${clamped}%` }}
        />
      </div>
    </div>
  )
}
