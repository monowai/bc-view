import { HoldingContract, Position } from "types/beancounter"
import { ValueIn } from "@components/features/holdings/GroupByOptions"

export type GroupingMode = "category" | "asset" | "market"

export interface AllocationSlice {
  [key: string]: string | number // Index signature for Recharts compatibility
  key: string
  label: string
  value: number
  percentage: number
  color: string
}

// Color palette for known categories
const CATEGORY_COLORS: Record<string, string> = {
  Equity: "#3B82F6", // blue
  "Exchange Traded Fund": "#10B981", // green
  ETF: "#10B981", // green (alias)
  Cash: "#6B7280", // gray
  "Mutual Fund": "#8B5CF6", // purple
  RE: "#F59E0B", // amber
  Account: "#EC4899", // pink
  Trade: "#14B8A6", // teal
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
    case "category":
      return {
        key: position.asset.assetCategory.name,
        label: position.asset.assetCategory.name,
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
  }
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

  // Aggregate market values by group
  const aggregated = new Map<string, { label: string; value: number }>()

  for (const positionKey of Object.keys(holdingContract.positions)) {
    const position = holdingContract.positions[positionKey]
    const moneyValues = position.moneyValues[valueIn]

    if (!moneyValues) continue

    const { key, label } = getGroupKey(position, groupBy)
    const marketValue = moneyValues.marketValue || 0

    const existing = aggregated.get(key)
    if (existing) {
      existing.value += marketValue
    } else {
      aggregated.set(key, { label, value: marketValue })
    }
  }

  // Convert to array and calculate total
  const entries = Array.from(aggregated.entries())
  const total = entries.reduce((sum, [, data]) => sum + data.value, 0)

  if (total === 0) {
    return []
  }

  // Create slices with percentages and colors
  const slices: AllocationSlice[] = entries.map(([key, data], index) => ({
    key,
    label: data.label,
    value: data.value,
    percentage: (data.value / total) * 100,
    color: getColor(key, index),
  }))

  // Sort by value descending
  slices.sort((a, b) => b.value - a.value)

  return slices
}
