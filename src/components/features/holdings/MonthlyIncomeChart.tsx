import React from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { MonthlyIncomeResponse, IncomeGroupData } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"

interface MonthlyIncomeChartProps {
  data: MonthlyIncomeResponse
  currencySymbol?: string
  selectedGroup?: string | null
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

export const OTHER_COLOR = "#9CA3AF" // gray-400

// Beyond this many groups the chart shows the top few plus Other
const MAX_SERIES = 6
const TOP_SERIES = 5

export function groupColor(index: number, groupCount: number): string {
  if (groupCount > MAX_SERIES && index >= TOP_SERIES) return OTHER_COLOR
  return COLORS[index % COLORS.length]
}

export interface IncomeSeries {
  key: string
  color: string
  monthly: number[]
  members: string[]
}

export function monthlyIncome(
  group: IncomeGroupData,
  data: MonthlyIncomeResponse,
): number[] {
  return data.months.map(
    (month) =>
      group.monthlyData.find((m) => m.yearMonth === month.yearMonth)?.income ||
      0,
  )
}

// Chart series in income order, with a long tail folded into one grey Other
export function incomeSeries(data: MonthlyIncomeResponse): IncomeSeries[] {
  const count = data.groups.length
  const shown =
    count > MAX_SERIES ? data.groups.slice(0, TOP_SERIES) : data.groups
  const series = shown.map((group, index) => ({
    key: group.groupKey,
    color: groupColor(index, count),
    monthly: monthlyIncome(group, data),
    members: [group.groupKey],
  }))
  if (count <= MAX_SERIES) return series

  const tail = data.groups.slice(TOP_SERIES)
  return [
    ...series,
    {
      key: `Other (${tail.length})`,
      color: OTHER_COLOR,
      monthly: data.months.map((_, i) =>
        tail.reduce((sum, group) => sum + monthlyIncome(group, data)[i], 0),
      ),
      members: tail.map((group) => group.groupKey),
    },
  ]
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
  selectedGroup = null,
}) => {
  const series = incomeSeries(data)

  // Transform data for stacked bar chart
  const chartData: ChartDataPoint[] = data.months.map((month, monthIndex) => {
    const point: ChartDataPoint = {
      month: formatMonth(month.yearMonth),
    }

    series.forEach((s) => {
      point[s.key] = s.monthly[monthIndex]
    })

    return point
  })

  return (
    <div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
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
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="income"
                fill={s.color}
                fillOpacity={
                  selectedGroup && !s.members.includes(selectedGroup) ? 0.25 : 1
                }
                name={s.key}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-700">
        {series.map((s) => (
          <li key={s.key} className="flex items-center">
            <span
              className="w-2.5 h-2.5 rounded-sm mr-1.5"
              style={{ backgroundColor: s.color }}
            />
            {s.key}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Helper to format month string (YYYY-MM to short format like "Jan 24")
export function formatMonth(yearMonth: string): string {
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

// Toggle naming a group, shared by the ledger and the calendar
export const GroupToggle: React.FC<{
  groupKey: string
  expanded: boolean
  onToggle: (groupKey: string) => void
  children?: React.ReactNode
}> = ({ groupKey, expanded, onToggle, children }) => (
  <button
    type="button"
    aria-expanded={expanded}
    onClick={() => onToggle(groupKey)}
    className="flex items-center w-full text-left rounded-sm focus-visible:outline-2 focus-visible:outline-blue-600"
  >
    {children}
    <span className="truncate max-w-[200px]">{groupKey}</span>
  </button>
)

// Ranked ledger of groups; a row expands to its top contributors
interface IncomeBreakdownTableProps {
  data: MonthlyIncomeResponse
  currencySymbol: string
  groupByLabel: string
  selectedGroup: string | null
  onSelectGroup: (groupKey: string) => void
}

export const IncomeBreakdownTable: React.FC<IncomeBreakdownTableProps> = ({
  data,
  currencySymbol,
  groupByLabel,
  selectedGroup,
  onSelectGroup,
}) => {
  const share = (income: number, total: number): number =>
    total > 0 ? (income / total) * 100 : 0

  return (
    <div className="overflow-x-auto">
      <table
        aria-label={`Income by ${groupByLabel}`}
        className="min-w-full text-sm"
      >
        <thead>
          <tr className="border-b border-gray-200 text-xs font-medium text-gray-500">
            <th className="px-4 py-2 text-left font-medium">{groupByLabel}</th>
            <th className="px-4 py-2 text-right font-medium">Income</th>
            <th className="px-4 py-2 text-right font-medium">Share</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.groups.map((item, index) => {
            const percentage = share(item.totalIncome, data.totalIncome)
            const color = groupColor(index, data.groups.length)
            const expanded = selectedGroup === item.groupKey

            return (
              <React.Fragment key={item.groupKey}>
                <tr
                  className={`cursor-pointer hover:bg-blue-50 transition-colors ${expanded ? "bg-blue-50" : ""}`}
                  onClick={() => onSelectGroup(item.groupKey)}
                >
                  <th
                    scope="row"
                    className="px-4 py-2 whitespace-nowrap font-normal text-gray-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GroupToggle
                      groupKey={item.groupKey}
                      expanded={expanded}
                      onToggle={onSelectGroup}
                    >
                      <span
                        className="w-3 h-3 rounded-sm mr-2 flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                    </GroupToggle>
                  </th>
                  <td className="px-4 py-2 whitespace-nowrap text-right font-medium text-gray-900 tabular-nums">
                    {currencySymbol}
                    <FormatValue value={item.totalIncome} />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-right text-gray-500 tabular-nums">
                    <span className="inline-flex items-center justify-end gap-2">
                      {percentage.toFixed(1)}%
                      <span className="hidden sm:block w-14 h-1.5 bg-gray-100 rounded-sm overflow-hidden">
                        <span
                          className="block h-full"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: color,
                          }}
                        />
                      </span>
                    </span>
                  </td>
                </tr>
                {expanded &&
                  item.topContributors.map((contributor) => (
                    <tr key={contributor.assetId} className="bg-gray-50">
                      <td className="pl-9 pr-4 py-1.5 text-xs">
                        <span className="font-medium text-gray-900">
                          {contributor.assetCode}
                        </span>
                        {contributor.assetName && (
                          <span className="block text-gray-500 truncate max-w-[200px]">
                            {contributor.assetName}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-xs text-right text-gray-900 tabular-nums">
                        {currencySymbol}
                        <FormatValue value={contributor.totalIncome} />
                      </td>
                      <td className="px-4 py-1.5 text-xs text-right text-gray-500 tabular-nums">
                        {share(
                          contributor.totalIncome,
                          item.totalIncome,
                        ).toFixed(1)}
                        %
                      </td>
                    </tr>
                  ))}
              </React.Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200">
            <th scope="row" className="px-4 py-2 text-left font-semibold">
              Total
            </th>
            <td className="px-4 py-2 text-right font-bold text-gray-900 tabular-nums">
              {currencySymbol}
              <FormatValue value={data.totalIncome} />
            </td>
            <td className="px-4 py-2 text-right text-gray-500 tabular-nums">
              100%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default MonthlyIncomeChart
