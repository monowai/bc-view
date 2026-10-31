import React, { useState, useCallback } from "react"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { MonthlyIncomeResponse, Portfolio } from "types/beancounter"
import { IncomeLayout } from "types/app"
import MonthlyIncomeChart, {
  IncomeBreakdownTable,
  formatMonth,
} from "./MonthlyIncomeChart"
import IncomeCalendar from "./IncomeCalendar"
import { FormatValue } from "@components/ui/MoneyUtils"
import Alert from "@components/ui/Alert"
import { TableSkeletonLoader } from "@components/ui/SkeletonLoader"
import { useHoldingState } from "@lib/holdings/holdingState"
import { GROUP_BY_OPTIONS } from "types/constants"
import { incomeMonthlyKey } from "@utils/api/client/trns"

interface IncomeViewProps {
  portfolio?: Portfolio
  portfolioIds?: string[]
  isAggregated?: boolean
}

// Map frontend groupBy property paths to backend groupBy values
function mapGroupByToApi(groupByPath: string): string {
  switch (groupByPath) {
    case GROUP_BY_OPTIONS.ASSET_CLASS:
      return "assetClass"
    case GROUP_BY_OPTIONS.SECTOR:
      return "sector"
    case GROUP_BY_OPTIONS.MARKET_CURRENCY:
      return "currency"
    case GROUP_BY_OPTIONS.MARKET:
      return "market"
    default:
      return "assetClass"
  }
}

// Get display label for groupBy
function getGroupByLabel(groupByPath: string): string {
  switch (groupByPath) {
    case GROUP_BY_OPTIONS.ASSET_CLASS:
      return "Asset Class"
    case GROUP_BY_OPTIONS.SECTOR:
      return "Sector"
    case GROUP_BY_OPTIONS.MARKET_CURRENCY:
      return "Currency"
    case GROUP_BY_OPTIONS.MARKET:
      return "Market"
    default:
      return "Asset Class"
  }
}

const PERIODS = [6, 12, 24, 36]

const LAYOUTS: { value: IncomeLayout; label: string }[] = [
  { value: "chart", label: "Chart" },
  { value: "calendar", label: "Calendar" },
]

interface SegmentedProps<T> {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>): React.ReactElement {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex border border-gray-200 rounded-md overflow-hidden divide-x divide-gray-200"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`px-2.5 py-1 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 ${
            option.value === value
              ? "bg-blue-50 text-blue-700 font-semibold"
              : "bg-white text-gray-600 hover:text-gray-900"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

const IncomeView: React.FC<IncomeViewProps> = ({
  portfolio,
  portfolioIds,
  isAggregated = false,
}) => {
  const holdingState = useHoldingState()
  const months = holdingState.incomePeriod
  const layout = holdingState.incomeLayout
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  // Get groupBy from holding state and map to API value
  const groupByPath = holdingState.groupBy.value
  const apiGroupBy = mapGroupByToApi(groupByPath)
  const groupByLabel = getGroupByLabel(groupByPath)

  // Build API URL with parameters
  const params = new URLSearchParams()
  params.append("months", months.toString())
  params.append("groupBy", apiGroupBy)
  if (portfolio && !isAggregated) {
    params.append("portfolioIds", portfolio.id)
  } else if (portfolioIds && portfolioIds.length > 0) {
    params.append("portfolioIds", portfolioIds.join(","))
  }

  const apiUrl = incomeMonthlyKey(params.toString())
  const { data, error, isLoading } = useSwr<MonthlyIncomeResponse>(
    apiUrl,
    simpleFetcher(apiUrl),
  )

  const currencySymbol = portfolio?.currency?.symbol || "$"

  const handleSelectGroup = useCallback((groupKey: string) => {
    setSelectedGroup((current) => (current === groupKey ? null : groupKey))
  }, [])

  if (error) {
    return (
      <Alert variant="error">
        Failed to load income data. Please try again later.
      </Alert>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  const avgMonthlyIncome =
    data.months.length > 0 ? data.totalIncome / data.months.length : 0

  return (
    <div className="space-y-3">
      <div
        data-testid="income-headline"
        className="bg-white rounded-lg shadow-sm p-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3"
      >
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">
            {currencySymbol}
            <FormatValue value={data.totalIncome} />
          </span>
          <span className="text-sm text-gray-500">
            <span className="font-medium text-gray-900 tabular-nums">
              {currencySymbol}
              <FormatValue value={avgMonthlyIncome} />
            </span>{" "}
            a month
          </span>
          <span className="text-sm text-gray-500">
            {formatMonth(data.startMonth)} to {formatMonth(data.endMonth)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Period"
            options={PERIODS.map((value) => ({ value, label: `${value}m` }))}
            value={months}
            onChange={holdingState.setIncomePeriod}
          />
          <Segmented
            label="Layout"
            options={LAYOUTS}
            value={layout}
            onChange={holdingState.setIncomeLayout}
          />
        </div>
      </div>

      {data.groups.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center text-sm text-gray-500">
          No income in this period
        </div>
      ) : layout === "calendar" ? (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <IncomeCalendar
            data={data}
            currencySymbol={currencySymbol}
            groupByLabel={groupByLabel}
            selectedGroup={selectedGroup}
            onSelectGroup={handleSelectGroup}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-start">
          <div className="lg:col-span-3 bg-white rounded-lg shadow-sm p-4">
            <MonthlyIncomeChart
              data={data}
              currencySymbol={currencySymbol}
              selectedGroup={selectedGroup}
            />
          </div>
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm overflow-hidden">
            <IncomeBreakdownTable
              data={data}
              currencySymbol={currencySymbol}
              groupByLabel={groupByLabel}
              selectedGroup={selectedGroup}
              onSelectGroup={handleSelectGroup}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default IncomeView
