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

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Terminal Balance Percentiles
      </h3>
      <div className="space-y-2 text-sm">
        {(
          [
            ["p95", percentiles.p95],
            ["p75", percentiles.p75],
            ["p50", percentiles.p50],
            ["p25", percentiles.p25],
            ["p5", percentiles.p5],
          ] as [string, number][]
        ).map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between items-center"
          >
            <span className="text-gray-600">{label}</span>
            <span className="font-medium text-gray-900">
              {formatFullCurrency(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
