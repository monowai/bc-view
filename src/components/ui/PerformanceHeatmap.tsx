import React from "react"
import { HoldingGroup } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { isCash, isCashRelated } from "@lib/assets/assetUtils"

interface PerformanceHeatmapProps {
  holdingGroups: Record<string, HoldingGroup>
  valueIn: string
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
    case "totalReturn":
      thresholds = { strong: 0.1, positive: 0, flat: -0.05, negative: -0.2 }
      break
    case "irr":
      thresholds = { strong: 0.15, positive: 0.05, flat: 0, negative: -0.1 }
      break
    case "dailyGain":
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

export const PerformanceHeatmap: React.FC<PerformanceHeatmapProps> = ({
  holdingGroups,
  valueIn,
  className = "",
}) => {
  const [selectedMetric, setSelectedMetric] =
    React.useState<MetricType>("totalReturn")
  const cells: HeatmapCell[] = []

  Object.values(holdingGroups).forEach((group) => {
    group.positions.forEach((position) => {
      if (isCash(position.asset) || isCashRelated(position.asset)) return

      const moneyValues = position.moneyValues[valueIn]
      const totalGainPercent =
        moneyValues.costValue > 0
          ? moneyValues.totalGain / moneyValues.costValue
          : 0

      cells.push({
        code: position.asset.code,
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
  })

  // Sort by market value (largest positions first)
  cells.sort((a, b) => b.marketValue - a.marketValue)

  const totalMarketValue = cells.reduce(
    (sum, cell) => sum + cell.marketValue,
    0,
  )

  const getMetricValue = (cell: HeatmapCell, metric: MetricType): number => {
    switch (metric) {
      case "totalReturn":
        return cell.totalGainPercent
      case "irr":
        return cell.irr
      case "dailyGain":
        return cell.gainOnDay / cell.marketValue // Convert to percentage
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
            {(["totalReturn", "irr", "dailyGain"] as MetricType[]).map(
              (metric) => (
                <button
                  key={metric}
                  onClick={() => setSelectedMetric(metric)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedMetric === metric
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {getMetricLabel(metric)}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {cells.map((cell) => {
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
                    {cell.code.includes(".")
                      ? cell.code.substring(cell.code.indexOf(".") + 1)
                      : cell.code}
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

        <div className="mt-6 flex justify-between items-center text-sm">
          <div className="flex items-center space-x-4">
            {(() => {
              const thresholds =
                selectedMetric === "totalReturn"
                  ? { strong: 10, positive: 0, flat: -5, negative: -20 }
                  : selectedMetric === "irr"
                    ? { strong: 15, positive: 5, flat: 0, negative: -10 }
                    : { strong: 3, positive: 0, flat: -1, negative: -3 }

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
          Cell size indicates position weight • Hover for details
        </div>
      </div>
    </div>
  )
}

export default PerformanceHeatmap
