import React from "react"
import { MonteCarloResult } from "types/independence"

const HIDDEN_VALUE = "****"

interface PercentileTableProps {
  percentiles: MonteCarloResult["terminalBalancePercentiles"]
  currency: string
  hideValues: boolean
}

export function PercentileTable({
  percentiles,
  currency,
  hideValues,
}: PercentileTableProps): React.ReactElement {
  const formatFullCurrency = (value: number): string => {
    if (hideValues) return HIDDEN_VALUE
    return `${currency}${Math.round(value).toLocaleString()}`
  }

  // Read as: "X% of scenarios ended with at least this balance". p95 (top 5%)
  // reads as "5% reached ≥ Y"; p5 (bottom 5%) as "95% reached ≥ Y" — even the
  // worst paths cleared at least this amount. Keep labels tight; tooltip carries
  // the plain-English gloss.
  const rows: { label: string; tooltip: string; value: number }[] = [
    {
      label: "5% reached ≥",
      tooltip: "Top 5% of outcomes — only 5% of scenarios ended higher",
      value: percentiles.p95,
    },
    {
      label: "25% reached ≥",
      tooltip: "Top 25% of outcomes",
      value: percentiles.p75,
    },
    {
      label: "50% reached ≥",
      tooltip: "Median — half of scenarios ended at or above this balance",
      value: percentiles.p50,
    },
    {
      label: "75% reached ≥",
      tooltip: "Bottom 25% (lower quartile)",
      value: percentiles.p25,
    },
    {
      label: "95% reached ≥",
      tooltip:
        "Worst 5% — even the bottom 5% of scenarios cleared this balance",
      value: percentiles.p5,
    },
  ]

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        Terminal Balance Percentiles
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        Share of scenarios ending with at least this balance
      </p>
      <div className="space-y-2 text-sm">
        {rows.map(({ label, tooltip, value }) => (
          <div key={label} className="flex justify-between items-center">
            <span
              className="text-gray-600 cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2"
              title={tooltip}
            >
              {label}
            </span>
            <span className="font-medium text-gray-900">
              {formatFullCurrency(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
