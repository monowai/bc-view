import React from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { MonthlyIncomeResponse, IncomeGroupData } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"

interface MonthlyIncomeChartProps {
  data: MonthlyIncomeResponse
  currencySymbol?: string
}

// Color palette for chart bars
const COLORS = [
  "#3B82F6", // blue-500
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#EF4444", // red-500
  "#8B5CF6", // violet-500
  "#EC4899", // pink-500
  "#06B6D4", // cyan-500
  "#84CC16", // lime-500
  "#F97316", // orange-500
  "#6366F1", // indigo-500
]

export function getColorForIndex(index: number): string {
  return COLORS[index % COLORS.length]
}

interface ChartDataPoint {
  month: string
  [key: string]: string | number
}

interface TooltipPayloadItem {
  dataKey: string
  value: number
  color: string
  name: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
  currencySymbol: string
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  currencySymbol,
}) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0)
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs">
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div
            key={index}
            className="flex justify-between items-center text-sm"
          >
            <div className="flex items-center">
              <div
                className="w-3 h-3 rounded-sm mr-2"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-700 truncate max-w-[120px]">
                {entry.name}
              </span>
            </div>
            <span className="font-medium text-gray-900 ml-2 tabular-nums">
              {currencySymbol}
              <FormatValue value={entry.value} />
            </span>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
          <span className="font-medium text-gray-700">Total</span>
          <span className="font-bold text-gray-900 tabular-nums">
            {currencySymbol}
            <FormatValue value={total} />
          </span>
        </div>
      </div>
    )
  }
  return null
}

const MonthlyIncomeChart: React.FC<MonthlyIncomeChartProps> = ({
  data,
  currencySymbol = "$",
}) => {
  // Transform data for stacked bar chart
  const chartData: ChartDataPoint[] = data.months.map((month) => {
    const point: ChartDataPoint = {
      month: formatMonth(month.yearMonth),
    }

    data.groups.forEach((group) => {
      const monthData = group.monthlyData.find(
        (m) => m.yearMonth === month.yearMonth,
      )
      point[group.groupKey] = monthData?.income || 0
    })

    return point
  })

  // Get keys for the bars (group keys)
  const barKeys: string[] = data.groups.map((g) => g.groupKey)

  if (chartData.length === 0 || barKeys.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No income data available
      </div>
    )
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#E5E7EB" }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#E5E7EB" }}
            tickFormatter={(value) =>
              `${currencySymbol}${value.toLocaleString()}`
            }
          />
          <Tooltip
            content={<CustomTooltip currencySymbol={currencySymbol} />}
          />
          <Legend
            wrapperStyle={{ paddingTop: "10px" }}
            iconType="square"
            iconSize={10}
          />
          {barKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="income"
              fill={COLORS[index % COLORS.length]}
              name={key}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Helper to format month string (YYYY-MM to short format like "Jan 24")
function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-")
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]
  const monthIndex = parseInt(month, 10) - 1
  return `${monthNames[monthIndex]} ${year.slice(2)}`
}

// Income breakdown table component with click handling
interface IncomeBreakdownTableProps {
  data: MonthlyIncomeResponse
  currencySymbol: string
  groupByLabel: string
  onRowClick?: (item: IncomeGroupData) => void
}

export const IncomeBreakdownTable: React.FC<IncomeBreakdownTableProps> = ({
  data,
  currencySymbol,
  groupByLabel,
  onRowClick,
}) => {
  if (data.groups.length === 0) {
    return null
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {groupByLabel}
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Income
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              % of Total
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Top Contributors
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.groups.map((item, index) => {
            const percentage =
              data.totalIncome > 0
                ? (item.totalIncome / data.totalIncome) * 100
                : 0

            return (
              <tr
                key={item.groupKey}
                className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} ${onRowClick ? "cursor-pointer hover:bg-blue-50 transition-colors" : ""}`}
                onClick={() => onRowClick?.(item)}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-sm mr-2 flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="truncate max-w-[200px]">
                      {item.groupKey}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900 tabular-nums">
                  {currencySymbol}
                  <FormatValue value={item.totalIncome} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 tabular-nums">
                  {percentage.toFixed(1)}%
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-blue-600">
                  <button
                    className="inline-flex items-center hover:text-blue-800"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRowClick?.(item)
                    }}
                  >
                    <span className="mr-1">{item.topContributors.length}</span>
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
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="bg-gray-100">
          <tr>
            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
              Total
            </td>
            <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 tabular-nums">
              {currencySymbol}
              <FormatValue value={data.totalIncome} />
            </td>
            <td className="px-4 py-3 text-sm text-right text-gray-500 tabular-nums">
              100%
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default MonthlyIncomeChart
