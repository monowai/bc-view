import React, { useMemo, useState, useCallback } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { Holdings, MoneyValues } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import {
  AllocationSlice,
  GroupingMode,
} from "@lib/allocation/aggregateHoldings"
import { compareByReportCategory, compareBySector } from "@lib/categoryMapping"
import { useDisplayCurrencyConversion } from "@lib/hooks/useDisplayCurrencyConversion"

// Color palette for report categories
const CATEGORY_COLORS: Record<string, string> = {
  Equity: "#3B82F6", // blue
  ETF: "#10B981", // green
  "Mutual Fund": "#8B5CF6", // purple
  Cash: "#6B7280", // gray
  Property: "#F59E0B", // amber
}

const FALLBACK_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#6366F1",
]

interface SummaryViewProps {
  holdings: Holdings
  allocationData: AllocationSlice[]
  groupBy: GroupingMode
}

interface MetricCardProps {
  label: string
  value: number
  currencySymbol: string
  showSign?: boolean
  isPercentage?: boolean
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  currencySymbol,
  showSign = false,
  isPercentage = false,
}) => {
  const isPositive = value >= 0
  const colorClass = showSign
    ? isPositive
      ? "text-green-600"
      : "text-red-600"
    : "text-gray-900"

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${colorClass}`}>
        {showSign && value > 0 && "+"}
        {isPercentage ? (
          `${value.toFixed(2)}%`
        ) : (
          <>
            {currencySymbol}
            <FormatValue value={value} />
          </>
        )}
      </p>
    </div>
  )
}

interface TooltipPayload {
  name: string
  value: number
  payload: { name: string; [key: string]: number | string }
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  currencySymbol: string
  totalValue: number
}

const CustomBarTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  currencySymbol,
  totalValue,
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        {payload.map((entry, index) => {
          const percentage =
            totalValue > 0 ? (entry.value / totalValue) * 100 : 0
          return (
            <div key={index} className="flex items-center space-x-2 mb-1">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-700">{entry.name}:</span>
              <span className="font-medium">
                {currencySymbol}
                <FormatValue value={entry.value} />
              </span>
              <span className="text-gray-500">({percentage.toFixed(1)}%)</span>
            </div>
          )
        })}
      </div>
    )
  }
  return null
}

const SummaryView: React.FC<SummaryViewProps> = ({
  holdings,
  allocationData,
  groupBy,
}) => {
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(
    new Set(),
  )

  // Source currency is always the trade currency (what the values are denominated in)
  const sourceCurrency = holdings.viewTotals?.currency || holdings.currency

  // Use shared hook for display currency conversion
  const {
    convert,
    currencySymbol: effectiveCurrencySymbol,
    currencyCode: effectiveCurrencyCode,
  } = useDisplayCurrencyConversion({
    sourceCurrency,
    portfolio: holdings.portfolio,
  })

  const handleToggleCategory = useCallback((category: string) => {
    setExcludedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  // Get the viewTotals based on valueIn
  const viewTotals: MoneyValues = holdings.viewTotals

  // Filter allocation data and sort by predefined order
  const filteredAllocation = useMemo(() => {
    const sorter =
      groupBy === "sector" ? compareBySector : compareByReportCategory
    return allocationData
      .filter((slice) => !excludedCategories.has(slice.key))
      .sort((a, b) => sorter(a.key, b.key))
  }, [allocationData, excludedCategories, groupBy])

  // Calculate filtered total (with FX conversion)
  const filteredTotal = useMemo(() => {
    return filteredAllocation.reduce(
      (sum, slice) => sum + convert(slice.value),
      0,
    )
  }, [filteredAllocation, convert])

  // Transform data for stacked bar chart - single row with all categories (with FX conversion)
  const barData = useMemo(() => {
    const dataPoint: Record<string, number | string> = { name: "Allocation" }
    filteredAllocation.forEach((slice) => {
      dataPoint[slice.key] = convert(slice.value)
    })
    return [dataPoint]
  }, [filteredAllocation, convert])

  // Get colors for each category
  const getColor = (key: string, index: number): string => {
    return (
      CATEGORY_COLORS[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
    )
  }

  return (
    <div className="space-y-6">
      {/* Currency indicator */}
      {effectiveCurrencyCode && (
        <div className="flex justify-end">
          <span className="text-sm text-gray-500">
            Currency:{" "}
            <span className="font-medium text-gray-700">
              {effectiveCurrencyCode}
            </span>
          </span>
        </div>
      )}

      {/* Top Row: Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Market Value"
          value={convert(viewTotals.marketValue)}
          currencySymbol={effectiveCurrencySymbol}
        />
        <MetricCard
          label="Gain on Day"
          value={convert(viewTotals.gainOnDay)}
          currencySymbol={effectiveCurrencySymbol}
          showSign
        />
        <MetricCard
          label="Total Gain"
          value={convert(viewTotals.totalGain)}
          currencySymbol={effectiveCurrencySymbol}
          showSign
        />
        <MetricCard
          label="IRR"
          value={holdings.totals.irr * 100}
          currencySymbol={effectiveCurrencySymbol}
          showSign
          isPercentage
        />
      </div>

      {/* Second Row: Detail Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Dividends"
          value={convert(viewTotals.dividends)}
          currencySymbol={effectiveCurrencySymbol}
        />
        <MetricCard
          label="Purchases"
          value={convert(viewTotals.purchases)}
          currencySymbol={effectiveCurrencySymbol}
        />
        <MetricCard
          label="Sales"
          value={convert(viewTotals.sales)}
          currencySymbol={effectiveCurrencySymbol}
        />
        <MetricCard
          label="Unrealised Gain"
          value={convert(viewTotals.unrealisedGain)}
          currencySymbol={effectiveCurrencySymbol}
          showSign
        />
        <MetricCard
          label="Realised Gain"
          value={convert(viewTotals.realisedGain)}
          currencySymbol={effectiveCurrencySymbol}
          showSign
        />
      </div>

      {/* Stacked Horizontal Bar Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Asset Allocation
        </h3>

        <div className="h-16 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" hide />
              <Tooltip
                content={
                  <CustomBarTooltip
                    currencySymbol={effectiveCurrencySymbol}
                    totalValue={filteredTotal}
                  />
                }
              />
              {filteredAllocation.map((slice, index) => (
                <Bar
                  key={slice.key}
                  dataKey={slice.key}
                  stackId="allocation"
                  fill={getColor(slice.key, index)}
                  radius={
                    index === 0
                      ? [4, 0, 0, 4]
                      : index === filteredAllocation.length - 1
                        ? [0, 4, 4, 0]
                        : [0, 0, 0, 0]
                  }
                >
                  <Cell fill={getColor(slice.key, index)} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend with toggle */}
        <div className="flex flex-col space-y-2">
          <p className="text-xs text-gray-400 mb-1">Click to exclude/include</p>
          {[...allocationData]
            .sort((a, b) =>
              (groupBy === "sector"
                ? compareBySector
                : compareByReportCategory)(a.key, b.key),
            )
            .map((slice, index) => {
              const isExcluded = excludedCategories.has(slice.key)
              const convertedValue = convert(slice.value)
              const percentage =
                filteredTotal > 0 && !isExcluded
                  ? (convertedValue / filteredTotal) * 100
                  : 0

              return (
                <div
                  key={slice.key}
                  className={`flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2 ${
                    isExcluded ? "opacity-40" : ""
                  }`}
                  onClick={() => handleToggleCategory(slice.key)}
                >
                  <div className="flex items-center">
                    <div
                      className={`w-3 h-3 rounded-sm mr-2 ${isExcluded ? "bg-gray-300" : ""}`}
                      style={{
                        backgroundColor: isExcluded
                          ? undefined
                          : getColor(slice.key, index),
                      }}
                    />
                    <span
                      className={`text-sm ${isExcluded ? "text-gray-400 line-through" : "text-gray-700"}`}
                    >
                      {slice.label}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span
                      className={`text-sm font-medium ${isExcluded ? "text-gray-400" : "text-gray-900"}`}
                    >
                      {effectiveCurrencySymbol}
                      <FormatValue value={convertedValue} />
                    </span>
                    <span
                      className={`text-sm w-14 text-right ${isExcluded ? "text-gray-400" : "text-gray-500"}`}
                    >
                      {isExcluded ? "-" : `${percentage.toFixed(1)}%`}
                    </span>
                  </div>
                </div>
              )
            })}
        </div>

        {/* Totals */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              {excludedCategories.size > 0 ? "Filtered Total" : "Total"}
            </span>
            <span className="text-lg font-bold text-gray-900">
              {effectiveCurrencySymbol}
              <FormatValue value={filteredTotal} />
            </span>
          </div>
          {excludedCategories.size > 0 && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-400">Full Total</span>
              <span className="text-sm text-gray-400">
                {effectiveCurrencySymbol}
                <FormatValue
                  value={allocationData.reduce(
                    (sum, slice) => sum + convert(slice.value),
                    0,
                  )}
                />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SummaryView
