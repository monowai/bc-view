import React from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { AllocationSlice } from "@lib/allocation/aggregateHoldings"
import { FormatValue } from "@components/ui/MoneyUtils"

interface AllocationChartProps {
  data: AllocationSlice[]
  totalValue: number
  currencySymbol?: string
  excludedCategories?: Set<string>
  onToggleCategory?: (category: string) => void
}

interface TooltipPayload {
  payload: AllocationSlice
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const slice = payload[0].payload
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="font-semibold text-gray-900">{slice.label}</p>
        <p className="text-gray-600">
          <FormatValue value={slice.value} /> ({slice.percentage.toFixed(1)}%)
        </p>
      </div>
    )
  }
  return null
}

interface AllocationLegendProps {
  data: AllocationSlice[]
  excludedCategories?: Set<string>
  onToggleCategory?: (category: string) => void
}

const AllocationLegend: React.FC<AllocationLegendProps> = ({
  data,
  excludedCategories = new Set(),
  onToggleCategory,
}) => {
  return (
    <div className="flex flex-col space-y-2 mt-4">
      {onToggleCategory && (
        <p className="text-xs text-gray-400 mb-1">Click to exclude/include</p>
      )}
      {data.map((slice, index) => {
        const isExcluded = excludedCategories.has(slice.key)
        return (
          <div
            key={index}
            className={`flex items-center justify-between ${
              onToggleCategory
                ? "cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2"
                : ""
            } ${isExcluded ? "opacity-40" : ""}`}
            onClick={() => onToggleCategory?.(slice.key)}
          >
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-sm mr-2 ${isExcluded ? "bg-gray-300" : ""}`}
                style={{
                  backgroundColor: isExcluded ? undefined : slice.color,
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
                <FormatValue value={slice.value} />
              </span>
              <span
                className={`text-sm w-14 text-right ${isExcluded ? "text-gray-400" : "text-gray-500"}`}
              >
                {isExcluded ? "-" : `${slice.percentage.toFixed(1)}%`}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const AllocationChart: React.FC<AllocationChartProps> = ({
  data,
  totalValue,
  currencySymbol = "$",
  excludedCategories = new Set(),
  onToggleCategory,
}) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No allocation data available
      </div>
    )
  }

  // Filter out excluded categories for the chart
  const filteredData = data.filter(
    (slice) => !excludedCategories.has(slice.key),
  )

  // Recalculate percentages based on filtered total
  const filteredTotal = filteredData.reduce(
    (sum, slice) => sum + slice.value,
    0,
  )
  const chartData = filteredData.map((slice) => ({
    ...slice,
    percentage: filteredTotal > 0 ? (slice.value / filteredTotal) * 100 : 0,
  }))

  return (
    <div className="w-full">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="label"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="text-center mb-4">
        <span className="text-sm text-gray-500">
          {excludedCategories.size > 0 ? "Filtered Total" : "Total"}
        </span>
        <p className="text-2xl font-bold text-gray-900">
          {currencySymbol}
          <FormatValue value={filteredTotal} />
        </p>
        {excludedCategories.size > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            (Full total: {currencySymbol}
            <FormatValue value={totalValue} />)
          </p>
        )}
      </div>

      <AllocationLegend
        data={data.map((slice) => {
          // Recalculate percentage for included items based on filtered total
          if (!excludedCategories.has(slice.key) && filteredTotal > 0) {
            return { ...slice, percentage: (slice.value / filteredTotal) * 100 }
          }
          return slice
        })}
        excludedCategories={excludedCategories}
        onToggleCategory={onToggleCategory}
      />
    </div>
  )
}

export default AllocationChart
