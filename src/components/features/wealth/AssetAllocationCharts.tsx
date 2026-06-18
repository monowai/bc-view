import React, { useCallback, useMemo, useState } from "react"
import { Currency, HoldingContract } from "types/beancounter"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"
import { WealthSummary, LIQUIDITY_COLORS } from "@lib/wealth/liquidityGroups"
import {
  transformFxAllocationSlices,
  GroupingMode,
} from "@lib/allocation/aggregateHoldings"
import AllocationControls from "@components/features/allocation/AllocationControls"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import { getLocalValue, setLocalValue } from "@lib/storage/localState"

const GROUP_BY_STORAGE_KEY = "wealth-allocation-groupby"
const PAGE_SIZE = 10

const GROUP_LABELS: Record<GroupingMode, string> = {
  category: "Category",
  sector: "Sector",
  asset: "Asset",
  market: "Market",
}

interface AssetAllocationChartsProps {
  summary: WealthSummary
  holdings: HoldingContract | undefined
  fxRates: Record<string, number>
  displayCurrency: Currency | null
  collapsed: boolean
  onToggle: () => void
}

const AssetAllocationCharts: React.FC<AssetAllocationChartsProps> = ({
  summary,
  holdings,
  fxRates,
  displayCurrency,
  collapsed,
  onToggle,
}) => {
  // Grouping preference persists across sessions; defaults to "asset".
  const [groupBy, setGroupBy] = useState<GroupingMode>(() =>
    getLocalValue<GroupingMode>(GROUP_BY_STORAGE_KEY, "asset"),
  )
  const [page, setPage] = useState(0)
  const handleGroupByChange = useCallback((next: GroupingMode): void => {
    setGroupBy(next)
    setLocalValue(GROUP_BY_STORAGE_KEY, next)
    setPage(0) // item count differs per grouping; restart paging
  }, [])

  const allocationData = useMemo(
    () =>
      holdings ? transformFxAllocationSlices(holdings, groupBy, fxRates) : [],
    [holdings, groupBy, fxRates],
  )

  // Clamp the active page if the underlying data shrinks beneath it.
  const pageCount = Math.max(1, Math.ceil(allocationData.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageStart = safePage * PAGE_SIZE
  const pagedSlices = allocationData.slice(pageStart, pageStart + PAGE_SIZE)

  // The asset grouping always reads as a list (one row per holding) so every
  // holding stays legible; other groupings keep the pie while the slice count
  // is small and only fall back to the list for a long tail. Pagination chrome
  // shows once there is more than one page, regardless of grouping.
  const asList = groupBy === "asset" || allocationData.length > PAGE_SIZE
  const showPagination = allocationData.length > PAGE_SIZE

  if (summary.portfolioBreakdown.length === 0) return null

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
        <>
          <AllocationControls
            groupBy={groupBy}
            onGroupByChange={handleGroupByChange}
            valueIn={ValueIn.PORTFOLIO}
            onValueInChange={() => {}}
            hideValueIn
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grouped Allocation — driven by the group-by control. The asset
                grouping always renders as a (paged) list so every holding is
                legible; other groupings show a pie while the slice count is
                short and fall back to the list only for a long tail. */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-md font-medium text-gray-700 mb-4">
                {`By ${GROUP_LABELS[groupBy]}`}
              </h3>
              {allocationData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  No allocation data available
                </div>
              ) : !asList ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="label"
                      >
                        {allocationData.map((slice) => (
                          <Cell key={slice.key} fill={slice.color} />
                        ))}
                      </Pie>
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
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    {pagedSlices.map((slice) => (
                      <div
                        key={slice.key}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: slice.color }}
                          />
                          <span className="text-sm text-gray-700 truncate">
                            {slice.label}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 shrink-0">
                          <span className="text-sm font-semibold text-gray-900 tabular-nums">
                            {displayCurrency?.symbol}
                            {Number(slice.value).toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                          <span className="text-xs text-gray-500 tabular-nums w-12 text-right">
                            {Number(slice.percentage).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {showPagination && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setPage(safePage - 1)}
                        disabled={safePage === 0}
                        className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <i className="fas fa-chevron-left mr-1"></i>Prev
                      </button>
                      <span className="text-xs text-gray-500 tabular-nums">
                        {pageStart + 1}–
                        {Math.min(pageStart + PAGE_SIZE, allocationData.length)}{" "}
                        of {allocationData.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage(safePage + 1)}
                        disabled={safePage >= pageCount - 1}
                        className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next<i className="fas fa-chevron-right ml-1"></i>
                      </button>
                    </div>
                  )}
                </>
              )}
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
                              LIQUIDITY_COLORS[item.classification] ||
                              "#6B7280",
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
        </>
      )}
    </div>
  )
}

export default AssetAllocationCharts
