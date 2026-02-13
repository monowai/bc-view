import React from "react"
import { Currency } from "types/beancounter"
import { PieChart, Pie, ResponsiveContainer, Tooltip, Legend } from "recharts"
import {
  WealthSummary,
  COLORS,
  LIQUIDITY_COLORS,
} from "@lib/wealth/liquidityGroups"

interface AssetAllocationChartsProps {
  summary: WealthSummary
  displayCurrency: Currency | null
  collapsed: boolean
  onToggle: () => void
}

const AssetAllocationCharts: React.FC<AssetAllocationChartsProps> = ({
  summary,
  displayCurrency,
  collapsed,
  onToggle,
}) => {
  if (summary.portfolioBreakdown.length === 0) return null

  const portfolioChartData = summary.portfolioBreakdown.map((p, index) => ({
    name: p.code,
    value: p.value,
    fill: COLORS[index % COLORS.length],
  }))

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-8">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center text-lg font-semibold text-gray-900 hover:text-gray-700 mb-4"
      >
        <i
          className={`fas fa-chevron-${collapsed ? "right" : "down"} text-gray-400 mr-2 w-4`}
        ></i>
        <i className="fas fa-chart-pie text-gray-400 mr-2"></i>
        Asset Allocation
      </button>

      {!collapsed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Portfolio Breakdown Chart */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-md font-medium text-gray-700 mb-4">
              By Portfolio
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={portfolioChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  />
                  <Tooltip
                    formatter={(value) => [
                      `${displayCurrency?.symbol}${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                      "Value",
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Liquidity Breakdown */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-md font-medium text-gray-700 mb-4">
              By Liquidity
            </h3>
            <div className="flex flex-col gap-3">
              {/* Stacked bar overview */}
              <div className="flex h-6 rounded-full overflow-hidden">
                {summary.classificationBreakdown.map((item) => (
                  <div
                    key={item.classification}
                    className="transition-all"
                    style={{
                      width: `${Math.max(item.percentage, 1)}%`,
                      backgroundColor:
                        LIQUIDITY_COLORS[item.classification] || "#6B7280",
                    }}
                    title={`${item.classification}: ${item.percentage.toFixed(1)}%`}
                  />
                ))}
              </div>

              {/* Category rows */}
              <div className="flex flex-col gap-2 mt-1">
                {summary.classificationBreakdown.map((item) => (
                  <div
                    key={item.classification}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            LIQUIDITY_COLORS[item.classification] || "#6B7280",
                        }}
                      />
                      <span className="text-sm text-gray-700">
                        {item.classification}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">
                        {displayCurrency?.symbol}
                        {item.value.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                      <span className="text-xs text-gray-500 tabular-nums w-12 text-right">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Market exposure callout */}
              {(() => {
                const investmentPct =
                  summary.classificationBreakdown.find(
                    (c) => c.classification === "Investment",
                  )?.percentage ?? 0
                return (
                  <div className="mt-2 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">
                        Market Exposure
                      </span>
                      <span className="text-lg font-bold text-blue-600 tabular-nums">
                        {investmentPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssetAllocationCharts
