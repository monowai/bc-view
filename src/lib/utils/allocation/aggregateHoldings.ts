import { HoldingContract, Holdings, Position } from "types/beancounter"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import { getReportCategory } from "../categoryMapping"

export type GroupingMode = "category" | "asset" | "market" | "sector"

export interface AllocationSlice {
  [key: string]: string | number // Index signature for Recharts compatibility
  key: string
  label: string
  value: number
  percentage: number
  color: string
  gainOnDay: number
  irr: number
}

// Color palette for report categories
const CATEGORY_COLORS: Record<string, string> = {
  Equity: "#3B82F6", // blue
  ETF: "#10B981", // green
  "Mutual Fund": "#8B5CF6", // purple
  Cash: "#6B7280", // gray
  Property: "#F59E0B", // amber
  Pension: "#0EA5E9", // sky — composite assets (CPF / ILP / generic)
}

// Fallback colors for dynamic values
const FALLBACK_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#14B8A6", // teal
  "#6366F1", // indigo
  "#84CC16", // lime
  "#F97316", // orange
]

function getColor(key: string, index: number): string {
  return CATEGORY_COLORS[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

function getGroupKey(
  position: Position,
  groupBy: GroupingMode,
): { key: string; label: string } {
  switch (groupBy) {
    case "category": {
      const reportCategory = getReportCategory(position.asset)
      return {
        key: reportCategory,
        label: reportCategory,
      }
    }
    case "sector": {
      const sector = position.asset.sector || "Unclassified"
      return {
        key: sector,
        label: sector,
      }
    }
    case "asset":
      return {
        key: position.asset.code,
        label: position.asset.name,
      }
    case "market":
      return {
        key: position.asset.market.code,
        label: position.asset.market.code,
      }
    default:
      return { key: "unknown", label: "Unknown" }
  }
}

interface AggregatedData {
  label: string
  value: number
  gainOnDay: number
  // For weighted IRR calculation: sum of (marketValue * irr)
  weightedIrrSum: number
}

/**
 * Transform aggregated holdings from backend into chart slices.
 * The backend has already aggregated positions across all portfolios.
 */
export function transformToAllocationSlices(
  holdingContract: HoldingContract,
  groupBy: GroupingMode,
  valueIn: ValueIn,
): AllocationSlice[] {
  if (!holdingContract.positions) {
    return []
  }

  // Aggregate market values, gainOnDay, and IRR by group
  const aggregated = new Map<string, AggregatedData>()

  for (const positionKey of Object.keys(holdingContract.positions)) {
    const position = holdingContract.positions[positionKey]
    const moneyValues = position.moneyValues[valueIn]

    if (!moneyValues) continue

    const { key, label } = getGroupKey(position, groupBy)
    const marketValue = moneyValues.marketValue || 0
    const gainOnDay = moneyValues.gainOnDay || 0
    const irr = moneyValues.irr || 0

    const existing = aggregated.get(key)
    if (existing) {
      existing.value += marketValue
      existing.gainOnDay += gainOnDay
      existing.weightedIrrSum += marketValue * irr
    } else {
      aggregated.set(key, {
        label,
        value: marketValue,
        gainOnDay,
        weightedIrrSum: marketValue * irr,
      })
    }
  }

  // Convert to array and calculate total
  const entries = Array.from(aggregated.entries())
  const total = entries.reduce((sum, [, data]) => sum + data.value, 0)

  if (total === 0) {
    return []
  }

  // Create slices with percentages, colors, and weighted IRR
  const slices: AllocationSlice[] = entries.map(([key, data], index) => ({
    key,
    label: data.label,
    value: data.value,
    percentage: (data.value / total) * 100,
    color: getColor(key, index),
    gainOnDay: data.gainOnDay,
    irr: data.value > 0 ? data.weightedIrrSum / data.value : 0,
  }))

  // Sort by value descending
  slices.sort((a, b) => b.value - a.value)

  return slices
}

/**
 * FX-aware variant of {@link transformToAllocationSlices} for the Net Worth
 * (wealth) view, where positions span multiple base currencies. Values are
 * taken from each position's BASE money values and converted to the display
 * currency via `fxRates[baseCurrencyCode]` — the same per-position rule
 * `useWealthSummary` applies — so the grouped allocation reconciles with the
 * rest of the wealth page rather than mixing raw currencies.
 */
export function transformFxAllocationSlices(
  holdingContract: HoldingContract,
  groupBy: GroupingMode,
  fxRates: Record<string, number>,
): AllocationSlice[] {
  if (!holdingContract.positions) {
    return []
  }

  const aggregated = new Map<string, AggregatedData>()

  for (const positionKey of Object.keys(holdingContract.positions)) {
    const position = holdingContract.positions[positionKey]
    const moneyValues = position.moneyValues?.BASE
    if (!moneyValues) continue

    const currency = moneyValues.currency?.code
    const rate = currency ? fxRates[currency] || 1 : 1
    const { key, label } = getGroupKey(position, groupBy)
    const marketValue = (moneyValues.marketValue || 0) * rate
    const gainOnDay = (moneyValues.gainOnDay || 0) * rate
    const irr = moneyValues.irr || 0

    const existing = aggregated.get(key)
    if (existing) {
      existing.value += marketValue
      existing.gainOnDay += gainOnDay
      existing.weightedIrrSum += marketValue * irr
    } else {
      aggregated.set(key, {
        label,
        value: marketValue,
        gainOnDay,
        weightedIrrSum: marketValue * irr,
      })
    }
  }

  const entries = Array.from(aggregated.entries())
  const total = entries.reduce((sum, [, data]) => sum + data.value, 0)
  if (total === 0) {
    return []
  }

  // Suppress zero-value holdings (e.g. fully-exited positions) — they add
  // noise to the legend and render as invisible slices.
  const slices: AllocationSlice[] = entries
    .filter(([, data]) => data.value !== 0)
    .map(([key, data], index) => ({
      key,
      label: data.label,
      value: data.value,
      percentage: (data.value / total) * 100,
      color: getColor(key, index),
      gainOnDay: data.gainOnDay,
      irr: data.value > 0 ? data.weightedIrrSum / data.value : 0,
    }))

  slices.sort((a, b) => b.value - a.value)
  return slices
}

/**
 * Build chart slices from svc-retire's server-side asset breakdown. Used by
 * the Independence plan page so composite assets (CPF / ILP / generic
 * pensions) appear alongside portfolio categories without bc-view having to
 * re-derive them from svc-position holdings (which never see composite
 * balances). See `feedback_backend_drives_display_data`.
 */
export function serverBreakdownToAllocationSlices(
  breakdown: Array<{ category: string; value: number }>,
): AllocationSlice[] {
  if (!breakdown || breakdown.length === 0) return []
  const total = breakdown.reduce((sum, b) => sum + Number(b.value || 0), 0)
  if (total <= 0) return []
  const slices: AllocationSlice[] = breakdown.map((b, index) => {
    const value = Number(b.value || 0)
    return {
      key: b.category,
      label: b.category,
      value,
      percentage: (value / total) * 100,
      color: getColor(b.category, index),
      gainOnDay: 0,
      irr: 0,
    }
  })
  slices.sort((a, b) => b.value - a.value)
  return slices
}

/**
 * Transform Holdings (with pre-calculated holdingGroups) into chart slices.
 * Uses the already-calculated weightedIrr from subTotals for consistency with SubTotal display.
 */
export function transformHoldingsToAllocationSlices(
  holdings: Holdings,
  valueIn: ValueIn,
): AllocationSlice[] {
  if (!holdings.holdingGroups) {
    return []
  }

  const entries = Object.entries(holdings.holdingGroups)
  const total = entries.reduce(
    (sum, [, group]) => sum + group.subTotals[valueIn].marketValue,
    0,
  )

  if (total === 0) {
    return []
  }

  // Create slices using the pre-calculated subTotals (which have correct weightedIrr)
  const slices: AllocationSlice[] = entries.map(([groupKey, group], index) => {
    const subTotals = group.subTotals[valueIn]
    return {
      key: groupKey,
      label: groupKey,
      value: subTotals.marketValue,
      percentage: (subTotals.marketValue / total) * 100,
      color: getColor(groupKey, index),
      gainOnDay: subTotals.gainOnDay,
      irr: subTotals.weightedIrr, // Use pre-calculated weighted IRR from backend
    }
  })

  // Sort by value descending
  slices.sort((a, b) => b.value - a.value)

  return slices
}
