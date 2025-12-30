import React, { useMemo, useState, useCallback } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts"
import { Holdings, MoneyValues } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { ProgressBar } from "@components/ui/ProgressBar"
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

// Get color for alpha progress bar based on IRR performance
const getAlphaColor = (irr: number): "blue" | "green" | "purple" | "gray" => {
  if (irr >= 0.15) return "green" // 15%+ = green (excellent)
  if (irr >= 0.08) return "blue" // 8-15% = blue (good)
  if (irr >= 0.03) return "purple" // 3-8% = purple (fair)
  return "gray" // <3% = gray (poor)
}

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

type ChartType = "none" | "bar" | "donut"

const SummaryView: React.FC<SummaryViewProps> = ({
  holdings,
  allocationData,
  groupBy,
}) => {
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(
    new Set(),
  )
  const [chartType, setChartType] = useState<ChartType>("none")

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
      {/* Top Row: Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label={`Market Value - ${effectiveCurrencyCode}`}
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
          label="Realised Gain"
          value={convert(viewTotals.realisedGain)}
          currencySymbol={effectiveCurrencySymbol}
          showSign
        />
        <MetricCard
          label={`Unrealised Gain - ${effectiveCurrencyCode}`}
          value={convert(viewTotals.unrealisedGain)}
          currencySymbol={effectiveCurrencySymbol}
          showSign
        />
      </div>

      {/* Asset Allocation Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Asset Allocation
          </h3>
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setChartType("none")}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                chartType === "none"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Table only"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M3 14h18M3 18h18M3 6h18"
                />
              </svg>
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                chartType === "bar"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Bar chart"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </button>
            <button
              onClick={() => setChartType("donut")}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                chartType === "donut"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Donut chart"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
                />
              </svg>
            </button>
          </div>
        </div>

        {chartType === "bar" && (
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
        )}
        {chartType === "donut" && (
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={filteredAllocation.map((slice, index) => ({
                    ...slice,
                    fill: getColor(slice.key, index),
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="label"
                >
                  {filteredAllocation.map((slice, index) => (
                    <Cell key={slice.key} fill={getColor(slice.key, index)} />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <CustomBarTooltip
                      currencySymbol={effectiveCurrencySymbol}
                      totalValue={filteredTotal}
                    />
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Allocation Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 font-medium text-gray-600">
                  Group
                </th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">
                  Market Value
                </th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">
                  Change
                </th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">
                  IRR
                </th>
                <th className="text-center py-2 px-2 font-medium text-gray-600 hidden md:table-cell">
                  Alpha
                </th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">
                  Weight
                </th>
              </tr>
            </thead>
            <tbody>
              {[...allocationData]
                .sort((a, b) =>
                  (groupBy === "sector"
                    ? compareBySector
                    : compareByReportCategory)(a.key, b.key),
                )
                .map((slice, index) => {
                  const isExcluded = excludedCategories.has(slice.key)
                  const convertedValue = convert(slice.value)
                  const convertedGainOnDay = convert(slice.gainOnDay)
                  const percentage =
                    filteredTotal > 0 && !isExcluded
                      ? (convertedValue / filteredTotal) * 100
                      : 0
                  const gainOnDayPositive = convertedGainOnDay >= 0

                  return (
                    <tr
                      key={slice.key}
                      className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                        isExcluded ? "opacity-40" : ""
                      }`}
                      onClick={() => handleToggleCategory(slice.key)}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center">
                          <div
                            className={`w-3 h-3 rounded-sm mr-2 flex-shrink-0 ${isExcluded ? "bg-gray-300" : ""}`}
                            style={{
                              backgroundColor: isExcluded
                                ? undefined
                                : getColor(slice.key, index),
                            }}
                          />
                          <span
                            className={
                              isExcluded
                                ? "text-gray-400 line-through"
                                : "text-gray-900"
                            }
                          >
                            {slice.label}
                          </span>
                        </div>
                      </td>
                      <td
                        className={`py-2 px-2 text-right tabular-nums ${isExcluded ? "text-gray-400" : "text-gray-900"}`}
                      >
                        {effectiveCurrencySymbol}
                        <FormatValue value={convertedValue} />
                      </td>
                      <td
                        className={`py-2 px-2 text-right tabular-nums ${
                          isExcluded
                            ? "text-gray-400"
                            : gainOnDayPositive
                              ? "text-green-600"
                              : "text-red-600"
                        }`}
                      >
                        {gainOnDayPositive && convertedGainOnDay > 0 && "+"}
                        {effectiveCurrencySymbol}
                        <FormatValue value={convertedGainOnDay} />
                      </td>
                      <td
                        className={`py-2 px-2 text-right tabular-nums ${
                          isExcluded
                            ? "text-gray-400"
                            : slice.irr >= 0
                              ? "text-green-600"
                              : "text-red-600"
                        }`}
                      >
                        {slice.irr >= 0 && slice.irr > 0 && "+"}
                        {(slice.irr * 100).toFixed(2)}%
                      </td>
                      <td
                        className={`py-2 px-2 hidden md:table-cell ${isExcluded ? "opacity-40" : ""}`}
                      >
                        <ProgressBar
                          value={Math.abs(slice.irr)}
                          maxValue={0.3}
                          showLabel={false}
                          size="sm"
                          color={isExcluded ? "gray" : getAlphaColor(slice.irr)}
                        />
                      </td>
                      <td
                        className={`py-2 px-2 text-right tabular-nums ${isExcluded ? "text-gray-400" : "text-gray-600"}`}
                      >
                        {isExcluded ? "-" : `${percentage.toFixed(1)}%`}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-medium">
                <td className="py-2 px-2 text-gray-700">
                  {excludedCategories.size > 0 ? "Filtered Total" : "Total"}
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-gray-900">
                  {effectiveCurrencySymbol}
                  <FormatValue value={filteredTotal} />
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {(() => {
                    const totalGainOnDay = filteredAllocation.reduce(
                      (sum, slice) => sum + convert(slice.gainOnDay),
                      0,
                    )
                    const isPositive = totalGainOnDay >= 0
                    return (
                      <span
                        className={
                          isPositive ? "text-green-600" : "text-red-600"
                        }
                      >
                        {isPositive && totalGainOnDay > 0 && "+"}
                        {effectiveCurrencySymbol}
                        <FormatValue value={totalGainOnDay} />
                      </span>
                    )
                  })()}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  <span
                    className={
                      holdings.totals.irr >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {holdings.totals.irr >= 0 && holdings.totals.irr > 0 && "+"}
                    {(holdings.totals.irr * 100).toFixed(2)}%
                  </span>
                </td>
                <td className="py-2 px-2 hidden md:table-cell" />
                <td className="py-2 px-2 text-right tabular-nums text-gray-600">
                  100%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Click row to exclude/include from totals
        </p>
      </div>
    </div>
  )
}

export default SummaryView
