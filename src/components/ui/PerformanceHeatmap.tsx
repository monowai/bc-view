import React, { useState } from "react"
import { HoldingGroup } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { isCash, isCashRelated, stripOwnerPrefix } from "@lib/assets/assetUtils"
import { compareByReportCategory, compareBySector } from "@lib/categoryMapping"
import { GroupBy } from "@components/features/holdings/GroupByOptions"
import { ProgressBar } from "@components/ui/ProgressBar"

interface PerformanceHeatmapProps {
  holdingGroups: Record<string, HoldingGroup>
  valueIn: string
  groupBy?: string
  viewByGroup?: boolean // When true, show groups as cells instead of positions
  portfolioTotalValue?: number // Total portfolio value for weight calculation (includes cash)
  className?: string
}

type MetricType = "totalReturn" | "irr" | "dailyGain"

interface HeatmapCell {
  code: string
  name: string
  marketValue: number
  totalGain: number
  totalGainPercent: number
  weight: number
  unrealisedGain: number
  irr: number
  changePercent?: number
  gainOnDay: number
}

const getPerformanceColor = (value: number, metric: MetricType): string => {
  let thresholds: {
    strong: number
    positive: number
    flat: number
    negative: number
  }

  switch (metric) {
    case "irr":
      thresholds = { strong: 0.15, positive: 0.05, flat: 0, negative: -0.1 }
      break
    case "dailyGain":
    default:
      thresholds = { strong: 0.03, positive: 0, flat: -0.01, negative: -0.03 }
      break
  }

  if (value > thresholds.strong) return "bg-green-500 text-white"
  if (value > thresholds.positive) return "bg-green-200 text-green-900"
  if (value > thresholds.flat) return "bg-yellow-100 text-yellow-900"
  if (value > thresholds.negative) return "bg-red-200 text-red-900"
  return "bg-red-500 text-white"
}

const getOpacity = (weight: number): string => {
  if (weight >= 0.1) return "opacity-100"
  if (weight >= 0.05) return "opacity-90"
  if (weight >= 0.02) return "opacity-80"
  return "opacity-70"
}

interface GroupedCells {
  groupKey: string
  cells: HeatmapCell[]
  groupMarketValue: number
}

export const PerformanceHeatmap: React.FC<PerformanceHeatmapProps> = ({
  holdingGroups,
  valueIn,
  groupBy,
  viewByGroup = false,
  portfolioTotalValue,
  className = "",
}) => {
  const [selectedMetric, setSelectedMetric] =
    React.useState<MetricType>("dailyGain")
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  // Build grouped cells
  const sorter =
    groupBy === GroupBy.SECTOR ? compareBySector : compareByReportCategory

  const groupedCells: GroupedCells[] = Object.keys(holdingGroups)
    .sort(sorter)
    .map((groupKey) => {
      const group = holdingGroups[groupKey]
      const cells: HeatmapCell[] = []

      group.positions.forEach((position) => {
        if (isCash(position.asset) || isCashRelated(position.asset)) return

        const moneyValues = position.moneyValues[valueIn]
        const totalGainPercent =
          moneyValues.costValue > 0
            ? moneyValues.totalGain / moneyValues.costValue
            : 0

        cells.push({
          code: stripOwnerPrefix(position.asset.code),
          name: position.asset.name,
          marketValue: moneyValues.marketValue,
          totalGain: moneyValues.totalGain,
          totalGainPercent,
          weight: moneyValues.weight,
          unrealisedGain: moneyValues.unrealisedGain,
          irr: moneyValues.irr,
          changePercent: moneyValues.priceData?.changePercent,
          gainOnDay: moneyValues.gainOnDay,
        })
      })

      // Sort by market value within group
      cells.sort((a, b) => b.marketValue - a.marketValue)

      const groupMarketValue = cells.reduce(
        (sum, cell) => sum + cell.marketValue,
        0,
      )

      return { groupKey, cells, groupMarketValue }
    })
    .filter((g) => g.cells.length > 0) // Only show groups with non-cash positions

  const totalMarketValue = groupedCells.reduce(
    (sum, g) => sum + g.groupMarketValue,
    0,
  )

  // Build group-level cells for viewByGroup mode
  // Use portfolioTotalValue (includes cash) for weight calculation if provided
  const weightDenominator = portfolioTotalValue ?? totalMarketValue

  const groupCells: HeatmapCell[] = React.useMemo(() => {
    if (!viewByGroup) return []

    return groupedCells.map((g) => {
      const subTotals = holdingGroups[g.groupKey]?.subTotals?.[valueIn]
      const totalGain = subTotals?.totalGain || 0
      const costValue = subTotals?.costValue || 0
      const totalGainPercent = costValue > 0 ? totalGain / costValue : 0
      const irr = subTotals?.weightedIrr || subTotals?.irr || 0
      const gainOnDay = subTotals?.gainOnDay || 0

      return {
        code: g.groupKey,
        name: g.groupKey,
        marketValue: g.groupMarketValue,
        totalGain,
        totalGainPercent,
        weight:
          weightDenominator > 0 ? g.groupMarketValue / weightDenominator : 0,
        unrealisedGain: subTotals?.unrealisedGain || 0,
        irr,
        gainOnDay,
      }
    })
  }, [viewByGroup, groupedCells, holdingGroups, valueIn, weightDenominator])

  const getMetricValue = (cell: HeatmapCell, metric: MetricType): number => {
    switch (metric) {
      case "totalReturn":
        return cell.totalGainPercent
      case "irr":
        return cell.irr
      case "dailyGain":
        return cell.gainOnDay / cell.marketValue // Convert to percentage
      default:
        return 0
    }
  }

  const formatMetricValue = (cell: HeatmapCell, metric: MetricType): string => {
    const value = getMetricValue(cell, metric)
    return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`
  }

  const getMetricLabel = (metric: MetricType): string => {
    switch (metric) {
      case "totalReturn":
        return "Total Return"
      case "irr":
        return "IRR"
      case "dailyGain":
        return "Daily Gain"
      default:
        return metric
    }
  }

  const getMetricTooltip = (metric: MetricType): string => {
    switch (metric) {
      case "dailyGain":
        return "Today's change in value"
      case "totalReturn":
        return "Simple return: (Current Value - Cost) / Cost. Does not account for timing of purchases."
      case "irr":
        return "Internal Rate of Return: Annualized return accounting for when you bought and sold. Better for comparing investments held for different periods."
      default:
        return ""
    }
  }

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}
    >
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Performance Heatmap
            </h3>
            <p className="text-sm text-gray-600">
              Color intensity shows performance, cell size shows allocation
            </p>
          </div>
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            {(["dailyGain", "irr"] as MetricType[]).map((metric) => (
              <button
                key={metric}
                onClick={() => setSelectedMetric(metric)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedMetric === metric
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                title={getMetricTooltip(metric)}
              >
                {getMetricLabel(metric)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {viewByGroup ? (
          /* Group-level heatmap - each cell is a group */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {groupCells.map((cell) => {
              const metricValue = getMetricValue(cell, selectedMetric)
              const performanceColor = getPerformanceColor(
                metricValue,
                selectedMetric,
              )
              // Larger cells for group view
              const sizeClass =
                cell.weight >= 0.3
                  ? "h-32"
                  : cell.weight >= 0.15
                    ? "h-28"
                    : "h-24"

              return (
                <div
                  key={cell.code}
                  onClick={() => setSelectedGroup(cell.code)}
                  className={`
                    ${sizeClass} ${performanceColor}
                    rounded-xl p-4 flex flex-col justify-between
                    hover:scale-102 transition-all duration-200 cursor-pointer
                    shadow-md hover:shadow-lg
                  `}
                  title={`Click to see assets in ${cell.name}`}
                >
                  <div>
                    <div className="text-base font-bold">{cell.code}</div>
                    <div className="text-xs opacity-80 mt-1">
                      {(cell.weight * 100).toFixed(1)}% of portfolio
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="text-lg font-bold">
                      {formatMetricValue(cell, selectedMetric)}
                    </div>
                    <div className="text-xs opacity-80">
                      <FormatValue value={cell.marketValue} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Position-level heatmap grouped by category */
          groupedCells.map((group) => (
            <div key={group.groupKey}>
              {/* Group Header */}
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-semibold text-gray-700">
                  {group.groupKey}
                </h4>
                <span className="text-xs text-gray-400">
                  ({group.cells.length})
                </span>
                <span className="ml-auto text-sm font-medium text-gray-600">
                  <FormatValue value={group.groupMarketValue} />
                </span>
              </div>

              {/* Cells Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {group.cells.map((cell) => {
                  const sizeClass =
                    cell.weight >= 0.1
                      ? "h-20"
                      : cell.weight >= 0.05
                        ? "h-16"
                        : "h-12"
                  const metricValue = getMetricValue(cell, selectedMetric)
                  const performanceColor = getPerformanceColor(
                    metricValue,
                    selectedMetric,
                  )
                  const opacity = getOpacity(cell.weight)

                  return (
                    <div
                      key={cell.code}
                      className={`
                        ${sizeClass} ${performanceColor} ${opacity}
                        rounded-lg p-2 flex flex-col justify-between
                        hover:scale-105 transition-all duration-200 cursor-pointer
                        shadow-sm hover:shadow-md
                      `}
                      title={`${cell.name}\n${getMetricLabel(selectedMetric)}: ${formatMetricValue(cell, selectedMetric)}\nMarket Value: ${cell.marketValue.toLocaleString()}\nWeight: ${(cell.weight * 100).toFixed(2)}%`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">
                          {cell.code}
                        </div>
                        {cell.weight >= 0.05 && (
                          <div className="text-[10px] opacity-90 truncate mt-1">
                            {cell.name.length > 24
                              ? cell.name.substring(0, 24) + "..."
                              : cell.name}
                          </div>
                        )}
                      </div>

                      <div className="text-xs font-bold">
                        {formatMetricValue(cell, selectedMetric)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        <div className="mt-6 flex justify-between items-center text-sm">
          <div className="flex items-center space-x-4">
            {(() => {
              const thresholds =
                selectedMetric === "irr"
                  ? { strong: 15, positive: 5, flat: 0, negative: -10 }
                  : { strong: 3, positive: 0, flat: -1, negative: -3 } // dailyGain

              return (
                <>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="text-gray-600">
                      Strong ({">"}+{thresholds.strong}%)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-200 rounded"></div>
                    <span className="text-gray-600">
                      Positive ({thresholds.positive}-{thresholds.strong}%)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-yellow-100 rounded border"></div>
                    <span className="text-gray-600">
                      Flat ({thresholds.flat}-{thresholds.positive}%)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-red-200 rounded"></div>
                    <span className="text-gray-600">
                      Negative ({thresholds.negative}-{thresholds.flat}%)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-red-500 rounded"></div>
                    <span className="text-gray-600">
                      Poor ({"<"}
                      {thresholds.negative}%)
                    </span>
                  </div>
                </>
              )
            })()}
          </div>

          <div className="text-gray-600">
            Total: <FormatValue value={totalMarketValue} />
          </div>
        </div>

        <div className="mt-2 text-xs text-gray-500">
          {viewByGroup
            ? "Click a group to see individual assets"
            : "Cell size indicates position weight • Hover for details"}
        </div>
      </div>

      {/* Group Detail Modal */}
      {selectedGroup && viewByGroup && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedGroup(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedGroup}
                </h2>
                <p className="text-sm text-gray-500">
                  {groupedCells.find((g) => g.groupKey === selectedGroup)?.cells
                    .length || 0}{" "}
                  assets
                </p>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg
                  className="w-5 h-5 text-gray-500"
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

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 font-medium text-gray-600">Asset</th>
                    <th className="pb-2 font-medium text-gray-600 text-right">
                      Value
                    </th>
                    <th className="pb-2 font-medium text-gray-600 text-right">
                      IRR
                    </th>
                    <th className="pb-2 font-medium text-gray-600 w-32 hidden sm:table-cell">
                      Alpha
                    </th>
                    <th className="pb-2 font-medium text-gray-600 text-right">
                      Weight
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupedCells
                    .find((g) => g.groupKey === selectedGroup)
                    ?.cells.map((cell) => {
                      const irrColor =
                        cell.irr >= 0.15
                          ? "green"
                          : cell.irr >= 0.08
                            ? "blue"
                            : cell.irr >= 0.03
                              ? "purple"
                              : "gray"
                      return (
                        <tr
                          key={cell.code}
                          className="border-b border-gray-100"
                        >
                          <td className="py-3">
                            <div className="font-medium text-gray-900">
                              {cell.code}
                            </div>
                            <div className="text-xs text-gray-500 truncate max-w-[150px]">
                              {cell.name}
                            </div>
                          </td>
                          <td className="py-3 text-right text-gray-900">
                            <FormatValue value={cell.marketValue} />
                          </td>
                          <td
                            className={`py-3 text-right font-medium ${
                              cell.irr >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {cell.irr >= 0 ? "+" : ""}
                            {(cell.irr * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 hidden sm:table-cell">
                            <ProgressBar
                              value={Math.abs(cell.irr)}
                              maxValue={0.3}
                              showLabel={false}
                              size="sm"
                              color={irrColor}
                            />
                          </td>
                          <td className="py-3 text-right text-gray-600">
                            {(cell.weight * 100).toFixed(1)}%
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Group Total</span>
                <span className="font-semibold text-gray-900">
                  <FormatValue
                    value={
                      groupedCells.find((g) => g.groupKey === selectedGroup)
                        ?.groupMarketValue || 0
                    }
                  />
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PerformanceHeatmap
