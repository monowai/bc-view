import React, { useEffect, useMemo, useRef, useState } from "react"
import { Currency, HoldingGroup, Portfolio, Position } from "types/beancounter"
import { GROUP_BY_OPTIONS } from "types/constants"
import { FormatValue } from "@components/ui/MoneyUtils"
import {
  isCash,
  isNonTradeable,
  stripOwnerPrefix,
} from "@lib/assets/assetUtils"
import { getGroupComparator } from "@lib/categoryMapping"
import { ProgressBar } from "@components/ui/ProgressBar"
import Dialog from "@components/ui/Dialog"
import { PositionCard } from "@components/features/holdings/CardView"
import { squarify, TreemapRect } from "@lib/holdings/treemapLayout"

interface PerformanceHeatmapProps {
  holdingGroups: Record<string, HoldingGroup>
  valueIn: string
  portfolio: Portfolio
  viewByGroup?: boolean // When true, show groups as cells instead of positions
  portfolioTotalValue?: number // Total portfolio value for weight calculation (includes cash)
  className?: string
}

type MetricType = "totalReturn" | "irr" | "dailyGain"
type ViewMode = "groups" | "assets"

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
  costValue: number
  // Only present on asset cells (Assets mode) — used to open the
  // holding-detail dialog. Group/classification cells omit it.
  position?: Position
}

interface GroupedCells {
  groupKey: string
  cells: HeatmapCell[]
  groupMarketValue: number
}

const UNKNOWN_CLASSIFICATION = "Unknown"

// Mirrors CardView's per-view sourceCurrency derivation (see CardView.tsx),
// specialised for a single position since the heatmap dialog shows one
// PositionCard at a time rather than a whole grouped view.
function getSourceCurrency(
  valueIn: string,
  portfolio: Portfolio,
  position: Position,
): Currency | undefined {
  if (valueIn === "PORTFOLIO") return portfolio.currency
  if (valueIn === "BASE") return portfolio.base
  return position.moneyValues?.TRADE?.currency || portfolio.currency
}

const FALLBACK_WIDTH = 800
const FALLBACK_HEIGHT = 480
// Canvas height adapts to the viewport so the full treemap (and the legend
// below it) stays on screen — reserved space covers app nav + card chrome.
const CANVAS_VIEWPORT_RESERVED = 290
const MIN_CANVAS_HEIGHT = 300
const MAX_CANVAS_HEIGHT = 840

// Color scale — darker/more saturated = bigger move (Google Finance style).
// dailyGain thresholds are fractions (0.02 = 2%); irr reuses the same table
// scaled x5 since annualized returns run much larger than daily moves.
const GRAY_NO_DATA = "#8a8f98"
const STRONG_GREEN = "#1f4d21"
const MID_GREEN = "#37652f"
const LIGHT_GREEN = "#5f8f57"
const FLAT = "#66716b"
const LIGHT_RED = "#c96b60"
const MID_RED = "#a03d36"
const STRONG_RED = "#7f1d1d"

const DAILY_GAIN_STRONG = 0.02
const DAILY_GAIN_MID = 0.0075
const DAILY_GAIN_LIGHT = 0.001
const IRR_SCALE = 5

export function getHeatColor(
  value: number | null | undefined,
  metric: MetricType,
): string {
  if (value === null || value === undefined) return GRAY_NO_DATA

  const scale = metric === "irr" ? IRR_SCALE : 1
  const strong = DAILY_GAIN_STRONG * scale
  const mid = DAILY_GAIN_MID * scale
  const light = DAILY_GAIN_LIGHT * scale

  if (value >= strong) return STRONG_GREEN
  if (value >= mid) return MID_GREEN
  if (value > light) return LIGHT_GREEN
  if (value >= -light) return FLAT
  if (value > -mid) return LIGHT_RED
  if (value > -strong) return MID_RED
  return STRONG_RED
}

function getMetricValue(
  cell: HeatmapCell,
  metric: MetricType,
  mode: ViewMode,
): number | null {
  switch (metric) {
    case "irr":
      return cell.irr
    case "totalReturn":
      return cell.totalGainPercent
    case "dailyGain":
    default:
      if (mode === "assets") {
        return cell.changePercent === undefined || cell.changePercent === null
          ? null
          : cell.changePercent
      }
      return cell.marketValue > 0 ? cell.gainOnDay / cell.marketValue : 0
  }
}

function formatMetricValue(value: number | null): string {
  if (value === null) return "--"
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`
}

function getMetricLabel(metric: MetricType): string {
  switch (metric) {
    case "totalReturn":
      return "Total Return"
    case "irr":
      return "IRR"
    case "dailyGain":
    default:
      return "Daily Gain"
  }
}

function getMetricTooltip(metric: MetricType): string {
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

interface HeatTileProps {
  cell: HeatmapCell
  rect: TreemapRect
  metric: MetricType
  mode: ViewMode
  onClick?: () => void
}

// Module-scoped tile renderer — kept out of PerformanceHeatmap's render body
// per the React Compiler rule against defining components inline. Exported
// (like getHeatColor) so the mobile compact-tile typography can be unit
// tested directly against a small TreemapRect without driving the full
// squarify layout.
export function HeatTile({
  cell,
  rect,
  metric,
  mode,
  onClick,
}: HeatTileProps): React.ReactElement {
  const value = getMetricValue(cell, metric, mode)
  const color = getHeatColor(value, metric)

  const w = rect.width
  const h = rect.height
  // Small tiles (typical on phones) get a compact type scale so they still
  // show a legible ticker/chip instead of rendering blank.
  const compact = w < 96 || h < 56
  const showTicker = w >= 40 && h >= 22
  const showChip = w >= 64 && h >= 44 && value !== null
  const showName = w >= 140 && h >= 90 && cell.name !== cell.code
  const showBadge = w >= 180 && h >= 110

  const padding = compact ? "p-1" : w >= 140 ? "p-3" : w >= 90 ? "p-2" : "p-1"

  const title =
    mode === "assets"
      ? `${cell.name}\n${getMetricLabel(metric)}: ${formatMetricValue(value)}\nMarket Value: ${cell.marketValue.toLocaleString()}\nWeight: ${(cell.weight * 100).toFixed(2)}%`
      : `Click to see assets in ${cell.name}`

  return (
    <div
      data-testid={`heatmap-tile-${mode}-${cell.code}`}
      title={title}
      onClick={onClick}
      className={`absolute rounded-xl overflow-hidden text-white ${padding} cursor-pointer`}
      style={{
        left: rect.x + 1.5,
        top: rect.y + 1.5,
        width: Math.max(rect.width - 3, 0),
        height: Math.max(rect.height - 3, 0),
        backgroundColor: color,
      }}
    >
      {showBadge && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-black/25 flex items-center justify-center text-[10px] font-bold">
          {(cell.name || cell.code).charAt(0).toUpperCase()}
        </div>
      )}
      {showTicker && (
        <div
          className={`font-bold truncate ${
            compact ? "text-[10px]" : "text-xs sm:text-sm pr-6"
          }`}
        >
          {cell.code}
        </div>
      )}
      {showName && (
        <div className="text-[10px] opacity-80 truncate">{cell.name}</div>
      )}
      {showChip && (
        <div
          data-testid={`heatmap-chip-${mode}-${cell.code}`}
          className={`mt-1 inline-flex items-center gap-1 font-semibold ${
            compact ? "text-[9px]" : "text-[11px]"
          }`}
        >
          <span>{formatMetricValue(value)}</span>
          <span
            className={`rounded-full bg-white/30 inline-flex items-center justify-center leading-none ${
              compact ? "w-3 h-3 text-[8px]" : "w-3.5 h-3.5 text-[9px]"
            }`}
          >
            {(value as number) >= 0 ? "↑" : "↓"}
          </span>
        </div>
      )}
    </div>
  )
}

export const PerformanceHeatmap: React.FC<PerformanceHeatmapProps> = ({
  holdingGroups,
  valueIn,
  portfolio,
  viewByGroup = false,
  portfolioTotalValue,
  className = "",
}) => {
  const [selectedMetric, setSelectedMetric] =
    React.useState<MetricType>("dailyGain")
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(
    null,
  )
  const [viewMode, setViewMode] = useState<ViewMode>(
    viewByGroup ? "groups" : "assets",
  )

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [canvasSize, setCanvasSize] = useState({
    width: FALLBACK_WIDTH,
    height: FALLBACK_HEIGHT,
  })

  useEffect(() => {
    const node = containerRef.current
    if (!node) return undefined

    const measure = (): void => {
      setCanvasSize({
        width: node.offsetWidth || FALLBACK_WIDTH,
        height: Math.min(
          MAX_CANVAS_HEIGHT,
          Math.max(
            MIN_CANVAS_HEIGHT,
            window.innerHeight - CANVAS_VIEWPORT_RESERVED,
          ),
        ),
      })
    }
    measure()

    window.addEventListener("resize", measure)
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null
    observer?.observe(node)
    return () => {
      window.removeEventListener("resize", measure)
      observer?.disconnect()
    }
  }, [])

  // Flatten every non-cash, tradeable position out of holdingGroups. The page's
  // groupBy is irrelevant here — Groups mode always regroups by classification
  // below, and Assets mode just wants the flat list.
  const assetCells: HeatmapCell[] = useMemo(() => {
    const cells: HeatmapCell[] = []

    Object.values(holdingGroups).forEach((group) => {
      group.positions.forEach((position) => {
        if (isCash(position.asset) || isNonTradeable(position.asset)) return

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
          costValue: moneyValues.costValue,
          position,
        })
      })
    })

    return cells
  }, [holdingGroups, valueIn])

  const totalMarketValue = assetCells.reduce(
    (sum, cell) => sum + cell.marketValue,
    0,
  )

  // Use portfolioTotalValue (includes cash) for weight calculation if provided
  const weightDenominator = portfolioTotalValue ?? totalMarketValue

  // Groups mode: regroup the flat asset cells by classification
  // (asset.assetCategory.name), ignoring the page's groupBy entirely.
  const classificationGroups: GroupedCells[] = useMemo(() => {
    const byClassification = new Map<string, HeatmapCell[]>()

    assetCells.forEach((cell) => {
      const key =
        cell.position?.asset.assetCategory?.name || UNKNOWN_CLASSIFICATION
      const existing = byClassification.get(key)
      if (existing) {
        existing.push(cell)
      } else {
        byClassification.set(key, [cell])
      }
    })

    const sorter = getGroupComparator(GROUP_BY_OPTIONS.ASSET_CLASS)

    return Array.from(byClassification.entries())
      .sort(([a], [b]) => sorter(a, b))
      .map(([groupKey, groupMembers]) => {
        const cells = [...groupMembers].sort(
          (a, b) => b.marketValue - a.marketValue,
        )
        const groupMarketValue = cells.reduce(
          (sum, cell) => sum + cell.marketValue,
          0,
        )
        return { groupKey, cells, groupMarketValue }
      })
  }, [assetCells])

  // Build group-level (classification) cells for Groups mode, aggregating
  // from the member asset cells since the page's holdingGroups.subTotals no
  // longer match this grouping.
  const groupCells: HeatmapCell[] = useMemo(() => {
    return classificationGroups.map((g) => {
      const marketValue = g.groupMarketValue
      const totalGain = g.cells.reduce((sum, cell) => sum + cell.totalGain, 0)
      const gainOnDay = g.cells.reduce((sum, cell) => sum + cell.gainOnDay, 0)
      const costValue = g.cells.reduce((sum, cell) => sum + cell.costValue, 0)
      const totalGainPercent = costValue > 0 ? totalGain / costValue : 0
      const unrealisedGain = g.cells.reduce(
        (sum, cell) => sum + cell.unrealisedGain,
        0,
      )
      const irr =
        marketValue > 0
          ? g.cells.reduce(
              (sum, cell) => sum + cell.irr * cell.marketValue,
              0,
            ) / marketValue
          : 0

      return {
        code: g.groupKey,
        name: g.groupKey,
        marketValue,
        totalGain,
        totalGainPercent,
        weight: weightDenominator > 0 ? marketValue / weightDenominator : 0,
        unrealisedGain,
        irr,
        gainOnDay,
        costValue,
      }
    })
  }, [classificationGroups, weightDenominator])

  const activeCells = viewMode === "groups" ? groupCells : assetCells

  const sortedCells = useMemo(
    () => [...activeCells].sort((a, b) => b.marketValue - a.marketValue),
    [activeCells],
  )

  const rects = useMemo(
    () =>
      squarify(
        sortedCells.map((cell) => ({ value: cell.marketValue, data: cell })),
        canvasSize.width,
        canvasSize.height,
      ),
    [sortedCells, canvasSize],
  )

  const isIrrMetric = selectedMetric === "irr"
  const legendLabels = isIrrMetric
    ? { neg: "-10%", mid: "0", pos: "+10%" }
    : { neg: "-2%", mid: "0", pos: "+2%" }

  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden ${className}`}
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Performance Heatmap
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Color intensity shows performance, tile size shows allocation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {(["groups", "assets"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === mode
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  }`}
                >
                  {mode === "groups" ? "Groups" : "Assets"}
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {(["dailyGain", "irr"] as MetricType[]).map((metric) => (
                <button
                  key={metric}
                  onClick={() => setSelectedMetric(metric)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedMetric === metric
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  }`}
                  title={getMetricTooltip(metric)}
                >
                  {getMetricLabel(metric)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div
          ref={containerRef}
          className="relative bg-gray-100 dark:bg-gray-950 rounded-lg p-[1.5px]"
          style={{ height: canvasSize.height }}
        >
          {rects.map((rect) => (
            <HeatTile
              key={`${viewMode}-${rect.data.code}`}
              cell={rect.data}
              rect={rect}
              metric={selectedMetric}
              mode={viewMode}
              onClick={
                viewMode === "groups"
                  ? () => setSelectedGroup(rect.data.code)
                  : () => {
                      if (rect.data.position) {
                        setSelectedPosition(rect.data.position)
                      }
                    }
              }
            />
          ))}
        </div>

        <div className="flex flex-wrap justify-between items-center gap-3 text-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className="w-4 h-4 rounded"
                style={{ backgroundColor: STRONG_RED }}
              />
              <span className="text-gray-600 dark:text-gray-400">
                {legendLabels.neg}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-4 h-4 rounded"
                style={{ backgroundColor: FLAT }}
              />
              <span className="text-gray-600 dark:text-gray-400">
                {legendLabels.mid}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-4 h-4 rounded"
                style={{ backgroundColor: STRONG_GREEN }}
              />
              <span className="text-gray-600 dark:text-gray-400">
                {legendLabels.pos}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-4 h-4 rounded"
                style={{ backgroundColor: GRAY_NO_DATA }}
              />
              <span className="text-gray-600 dark:text-gray-400">
                No price data
              </span>
            </div>
          </div>

          <div className="text-gray-600 dark:text-gray-400">
            Total: <FormatValue value={totalMarketValue} />
          </div>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-500">
          {viewMode === "groups"
            ? "Click a group to see individual assets"
            : "Tile size indicates market value • Hover for details"}
        </div>
      </div>

      {/* Group Detail Modal */}
      {selectedGroup && (
        <Dialog
          title={
            <div>
              <div>{selectedGroup}</div>
              <p className="text-sm text-gray-500 font-normal">
                {classificationGroups.find((g) => g.groupKey === selectedGroup)
                  ?.cells.length || 0}{" "}
                assets
              </p>
            </div>
          }
          onClose={() => setSelectedGroup(null)}
          maxWidth="2xl"
          scrollable
          footer={
            <div className="flex justify-between items-center text-sm w-full">
              <span className="text-gray-600">Group Total</span>
              <span className="font-semibold text-gray-900">
                <FormatValue
                  value={
                    classificationGroups.find(
                      (g) => g.groupKey === selectedGroup,
                    )?.groupMarketValue || 0
                  }
                />
              </span>
            </div>
          }
        >
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
                <th className="pb-2 pl-4 font-medium text-gray-600 w-32 hidden sm:table-cell">
                  Alpha
                </th>
                <th className="pb-2 font-medium text-gray-600 text-right">
                  Weight
                </th>
              </tr>
            </thead>
            <tbody>
              {classificationGroups
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
                    <tr key={cell.code} className="border-b border-gray-100">
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
        </Dialog>
      )}

      {/* Asset Detail Modal — reuses the card-view PositionCard, no action
          handlers since the heatmap is a read-only lens on the holding. */}
      {selectedPosition && (
        <Dialog
          title={
            <div>
              <div>{stripOwnerPrefix(selectedPosition.asset.code)}</div>
              <p className="text-sm text-gray-500 font-normal">
                {selectedPosition.asset.name}
              </p>
            </div>
          }
          onClose={() => setSelectedPosition(null)}
          maxWidth="md"
        >
          <PositionCard
            position={selectedPosition}
            portfolio={portfolio}
            valueIn={valueIn}
            sourceCurrency={getSourceCurrency(
              valueIn,
              portfolio,
              selectedPosition,
            )}
          />
        </Dialog>
      )}
    </div>
  )
}

export default PerformanceHeatmap
