import React, { useState } from "react"
import {
  formatCurrency,
  formatSignedNumber,
  gainLossClass,
} from "@lib/formatters"

interface CashSummaryPanelProps {
  currentMarketValue: number
  currentCash: number
  cashFromSales: number
  cashForPurchases: number
  /** cashFromSales - cashForPurchases + (currentCash - targetCash) — computed once in useRebalanceExecution; passed through, never recomputed here. */
  netImpact: number
  /** currentCash + netImpact, unclamped — computed once in useRebalanceExecution; passed through, never recomputed here. */
  projectedCash: number
  currency: string
  /** Default disclosure state. Defaults to expanded (desktop-friendly). */
  defaultExpanded?: boolean
}

interface StatCard {
  key: string
  label: string
  display: string
  valueClass: string
}

const CashSummaryPanel: React.FC<CashSummaryPanelProps> = ({
  currentMarketValue,
  currentCash,
  cashFromSales,
  cashForPurchases,
  netImpact,
  projectedCash,
  currency,
  defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const netImpactColor = gainLossClass(netImpact)

  const stats: StatCard[] = [
    {
      key: "currentCash",
      label: "Current Cash",
      display: `${formatCurrency(currentCash)} ${currency}`,
      valueClass: "text-gray-900",
    },
    {
      key: "fromSales",
      label: "From Sales",
      display: `+${formatCurrency(cashFromSales)} ${currency}`,
      valueClass: "text-green-600",
    },
    {
      key: "forPurchases",
      label: "For Purchases",
      display: `-${formatCurrency(cashForPurchases)} ${currency}`,
      valueClass: "text-red-600",
    },
    {
      key: "netImpact",
      label: "Net Impact",
      display: `${formatSignedNumber(netImpact)} ${currency}`,
      valueClass: netImpactColor,
    },
    {
      key: "projectedCash",
      label: "Projected Cash",
      display: `${formatCurrency(projectedCash)} ${currency}`,
      valueClass: "text-blue-600",
    },
    {
      key: "projectedValue",
      label: "Projected Value",
      display: `${formatCurrency(currentMarketValue)} ${currency}`,
      valueClass: "text-gray-900",
    },
  ]

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls="cash-summary-stats"
        className="w-full flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-left hover:bg-gray-100 rounded-lg transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <i
            className={`fas fa-chevron-${expanded ? "down" : "right"} text-xs text-gray-400 w-3`}
          ></i>
          {"Cash Summary"}
        </span>
        <span className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">
            {"Net Impact"}:{" "}
            <span
              data-testid="cash-summary-headline-net-impact"
              className={`font-bold ${netImpactColor}`}
            >
              {formatSignedNumber(netImpact)} {currency}
            </span>
          </span>
          <span className="text-gray-500">
            {"Projected Cash"}:{" "}
            <span
              data-testid="cash-summary-headline-projected-cash"
              className="font-bold text-blue-600"
            >
              {formatCurrency(projectedCash)} {currency}
            </span>
          </span>
        </span>
      </button>
      {expanded && (
        <div
          id="cash-summary-stats"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 px-4 pb-4"
        >
          {stats.map((stat) => (
            <div
              key={stat.key}
              className="bg-white border border-gray-200 rounded-md px-3 py-2"
            >
              <div className="text-xs text-gray-500 truncate">{stat.label}</div>
              <div
                className={`text-sm font-bold tabular-nums ${stat.valueClass}`}
              >
                {stat.display}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CashSummaryPanel
