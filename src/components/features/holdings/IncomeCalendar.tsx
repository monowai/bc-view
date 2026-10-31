import React from "react"
import { MonthlyIncomeResponse } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { GroupToggle, formatMonth, monthlyIncome } from "./MonthlyIncomeChart"

interface IncomeCalendarProps {
  data: MonthlyIncomeResponse
  currencySymbol: string
  groupByLabel: string
  selectedGroup: string | null
  onSelectGroup: (groupKey: string) => void
}

const MAX_TINT = 0.55
const WHITE_TEXT_FROM = 0.7

function wholeAmount(value: number): string {
  if (value === 0) return "·"
  const rounded = Math.round(value)
  return rounded === 0 ? "<1" : rounded.toLocaleString()
}

function cellText(value: number, strength: number): string {
  if (strength > WHITE_TEXT_FROM) return "text-white"
  return value === 0 ? "text-gray-400" : "text-gray-900"
}

// Groups by months; each cell is tinted by its size within the whole grid
const IncomeCalendar: React.FC<IncomeCalendarProps> = ({
  data,
  currencySymbol,
  groupByLabel,
  selectedGroup,
  onSelectGroup,
}) => {
  const rows = data.groups.map((group) => ({
    group,
    values: monthlyIncome(group, data),
  }))
  const largest = Math.max(...rows.flatMap((row) => row.values), 0)

  return (
    <div className="overflow-x-auto">
      <table aria-label="Income calendar" className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 font-medium text-gray-500">
            <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-medium">
              {groupByLabel}
            </th>
            {data.months.map((month) => (
              <th
                key={month.yearMonth}
                className="px-2 py-2 text-right font-medium whitespace-nowrap"
              >
                {formatMonth(month.yearMonth)}
              </th>
            ))}
            <th className="px-4 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(({ group, values }) => {
            const expanded = selectedGroup === group.groupKey
            return (
              <React.Fragment key={group.groupKey}>
                <tr>
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 px-4 py-2 whitespace-nowrap font-normal text-sm text-gray-900 ${expanded ? "bg-blue-50" : "bg-white"}`}
                  >
                    <GroupToggle
                      groupKey={group.groupKey}
                      expanded={expanded}
                      onToggle={onSelectGroup}
                    />
                  </th>
                  {values.map((value, index) => {
                    const strength = largest > 0 ? value / largest : 0
                    return (
                      <td
                        key={data.months[index].yearMonth}
                        className={`px-2 py-2 text-right tabular-nums ${cellText(value, strength)}`}
                        style={{
                          backgroundColor: `rgba(37, 99, 235, ${(strength * MAX_TINT).toFixed(2)})`,
                        }}
                      >
                        {wholeAmount(value)}
                      </td>
                    )
                  })}
                  <td className="px-4 py-2 text-right font-medium text-gray-900 tabular-nums whitespace-nowrap">
                    {currencySymbol}
                    <FormatValue value={group.totalIncome} />
                  </td>
                </tr>
                {expanded &&
                  group.topContributors.map((contributor) => (
                    <tr key={contributor.assetId} className="bg-gray-50">
                      <td className="sticky left-0 z-10 bg-gray-50 pl-8 pr-4 py-1.5 font-medium text-gray-900">
                        {contributor.assetCode}
                      </td>
                      <td
                        colSpan={data.months.length}
                        className="px-2 py-1.5 text-gray-500 truncate"
                      >
                        {contributor.assetName}
                      </td>
                      <td className="px-4 py-1.5 text-right text-gray-900 tabular-nums whitespace-nowrap">
                        {currencySymbol}
                        <FormatValue value={contributor.totalIncome} />
                      </td>
                    </tr>
                  ))}
              </React.Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200">
            <th
              scope="row"
              className="sticky left-0 z-10 bg-white px-4 py-2 text-left text-sm font-semibold"
            >
              Month total
            </th>
            {data.months.map((month) => (
              <td
                key={month.yearMonth}
                className="px-2 py-2 text-right font-medium text-gray-900 tabular-nums"
              >
                {wholeAmount(month.income)}
              </td>
            ))}
            <td className="px-4 py-2 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
              {currencySymbol}
              <FormatValue value={data.totalIncome} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default IncomeCalendar
