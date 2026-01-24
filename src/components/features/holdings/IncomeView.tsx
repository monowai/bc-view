import React, { useState, useCallback, useMemo } from "react"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import {
  MonthlyIncomeResponse,
  Portfolio,
  IncomeGroupData,
} from "types/beancounter"
import MonthlyIncomeChart, {
  IncomeBreakdownTable,
  getColorForIndex,
} from "./MonthlyIncomeChart"
import { FormatValue } from "@components/ui/MoneyUtils"
import { TableSkeletonLoader } from "@components/ui/SkeletonLoader"
import { useHoldingState } from "@lib/holdings/holdingState"
import { GROUP_BY_OPTIONS } from "types/constants"

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

// Popup component for showing top 10 contributors
interface ContributorsPopupProps {
  item: IncomeGroupData
  groupByLabel: string
  currencySymbol: string
  totalIncome: number
  colorIndex: number
  onClose: () => void
}

const ContributorsPopup: React.FC<ContributorsPopupProps> = ({
  item,
  groupByLabel,
  currencySymbol,
  totalIncome,
  colorIndex,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <div
              className="w-4 h-4 rounded-sm mr-3"
              style={{ backgroundColor: getColorForIndex(colorIndex) }}
            />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {item.groupKey}
              </h3>
              <p className="text-sm text-gray-500">
                Top 10 Contributors by Income
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Summary */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{groupByLabel} Total</span>
            <span className="text-lg font-bold text-gray-900 tabular-nums">
              {currencySymbol}
              <FormatValue value={item.totalIncome} />
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {totalIncome > 0
              ? ((item.totalIncome / totalIncome) * 100).toFixed(1)
              : 0}
            % of total income
          </div>
        </div>

        {/* Contributors List */}
        <div className="overflow-y-auto max-h-96">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Asset
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Income
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % of {groupByLabel}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {item.topContributors.map((contributor, index) => {
                const percentage =
                  item.totalIncome > 0
                    ? (contributor.totalIncome / item.totalIncome) * 100
                    : 0
                return (
                  <tr
                    key={contributor.assetId}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {contributor.assetCode}
                      </div>
                      {contributor.assetName && (
                        <div className="text-xs text-gray-500 truncate max-w-[200px]">
                          {contributor.assetName}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900 tabular-nums">
                      {currencySymbol}
                      <FormatValue value={contributor.totalIncome} />
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-500 tabular-nums">
                      {percentage.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
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
  const [selectedItem, setSelectedItem] = useState<{
    item: IncomeGroupData
    colorIndex: number
  } | null>(null)

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

  const apiUrl = `/api/trns/income/monthly?${params.toString()}`
  const { data, error, isLoading } = useSwr<MonthlyIncomeResponse>(
    apiUrl,
    simpleFetcher(apiUrl),
  )

  const currencySymbol = portfolio?.currency?.symbol || "$"

  // Handle row click to show contributors popup
  const handleRowClick = useCallback(
    (item: IncomeGroupData) => {
      const index =
        data?.groups.findIndex((g) => g.groupKey === item.groupKey) ?? 0
      setSelectedItem({ item, colorIndex: index })
    },
    [data],
  )

  const handleClosePopup = useCallback(() => {
    setSelectedItem(null)
  }, [])

  // Calculate stats
  const stats = useMemo(() => {
    if (!data) return { avgMonthlyIncome: 0, groupCount: 0 }
    return {
      avgMonthlyIncome:
        data.months.length > 0 ? data.totalIncome / data.months.length : 0,
      groupCount: data.groups.length,
    }
  }, [data])

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load income data. Please try again later.
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls - just period selector, groupBy comes from toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          {/* Month Range Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Period:</span>
            <select
              value={months}
              onChange={(e) =>
                holdingState.setIncomePeriod(parseInt(e.target.value, 10))
              }
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
              <option value={36}>36 months</option>
            </select>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          Grouped by:{" "}
          <span className="font-medium text-gray-700">{groupByLabel}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600">Total Income</div>
          <div className="text-2xl font-bold text-gray-900 tabular-nums">
            {currencySymbol}
            <FormatValue value={data.totalIncome} />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.startMonth} to {data.endMonth}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600">Monthly Average</div>
          <div className="text-2xl font-bold text-gray-900 tabular-nums">
            {currencySymbol}
            <FormatValue value={stats.avgMonthlyIncome} />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Over {data.months.length} months
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600">{groupByLabel}s</div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.groupCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">Paying dividends</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Monthly Income by {groupByLabel}
        </h3>
        <MonthlyIncomeChart data={data} currencySymbol={currencySymbol} />
      </div>

      {/* Breakdown Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">
            Income Breakdown by {groupByLabel}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Click on a row to see top 10 contributors
          </p>
        </div>
        <IncomeBreakdownTable
          data={data}
          currencySymbol={currencySymbol}
          groupByLabel={groupByLabel}
          onRowClick={handleRowClick}
        />
      </div>

      {/* Contributors Popup */}
      {selectedItem && (
        <ContributorsPopup
          item={selectedItem.item}
          groupByLabel={groupByLabel}
          currencySymbol={currencySymbol}
          totalIncome={data.totalIncome}
          colorIndex={selectedItem.colorIndex}
          onClose={handleClosePopup}
        />
      )}
    </div>
  )
}

export default IncomeView
