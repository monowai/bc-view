import React from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { AllocationSlice } from "@lib/allocation/aggregateHoldings"
import { FormatValue } from "@components/ui/MoneyUtils"

interface AllocationChartProps {
  data: AllocationSlice[]
  totalValue: number
  currencySymbol?: string
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
}

const AllocationLegend: React.FC<AllocationLegendProps> = ({ data }) => {
  return (
    <div className="flex flex-col space-y-2 mt-4">
      {data.map((slice, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex items-center">
            <div
              className="w-3 h-3 rounded-sm mr-2"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-sm text-gray-700">{slice.label}</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-900">
              <FormatValue value={slice.value} />
            </span>
            <span className="text-sm text-gray-500 w-14 text-right">
              {slice.percentage.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export const AllocationChart: React.FC<AllocationChartProps> = ({
  data,
  totalValue,
  currencySymbol = "$",
}) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No allocation data available
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="label"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="text-center mb-4">
        <span className="text-sm text-gray-500">Total</span>
        <p className="text-2xl font-bold text-gray-900">
          {currencySymbol}
          <FormatValue value={totalValue} />
        </p>
      </div>

      <AllocationLegend data={data} />
    </div>
  )
}

export default AllocationChart
