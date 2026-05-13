import type { Portfolio } from "types/beancounter"

/**
 * Liquidity groups that represent illiquid wealth — excluded from
 * the Wealth Performance widget which tracks marketable AUM only.
 *
 * Mirrors svc-retire's `HOUSING_CATEGORIES` (svc-position
 * AllocationService.kt) and `NON_SPENDABLE_CATEGORIES` (svc-retire
 * CalculationService.kt) — RE / Property maps to non-spendable.
 */
const ILLIQUID_GROUPS = new Set<string>(["Property"])

/**
 * Returns true when the portfolio's dominant liquidity group is liquid.
 *
 * A portfolio is treated as illiquid (and excluded from Wealth Performance)
 * when more of its base-currency market value falls into an illiquid group
 * (Property/RE) than any single liquid group. Portfolios with no
 * `assetClassification` (legacy / unvalued) are treated as liquid.
 */
export function isLiquidPortfolio(portfolio: Portfolio): boolean {
  const classification = portfolio.assetClassification
  if (!classification) return true
  const entries = Object.entries(classification)
  if (entries.length === 0) return true

  const groupTotals = new Map<string, number>()
  for (const [category, value] of entries) {
    const group = mapToLiquidityGroup(category)
    groupTotals.set(group, (groupTotals.get(group) ?? 0) + value)
  }

  let dominantGroup = ""
  let dominantValue = -Infinity
  for (const [group, value] of groupTotals) {
    if (value > dominantValue) {
      dominantGroup = group
      dominantValue = value
    }
  }

  return !ILLIQUID_GROUPS.has(dominantGroup)
}

export function mapToLiquidityGroup(categoryName: string): string {
  switch (categoryName) {
    case "Equity":
    case "Exchange Traded Fund":
    case "Mutual Fund":
      return "Investment"
    case "Cash":
    case "Bank Account":
    case "Trade":
      return "Cash"
    case "Real Estate":
    case "RE":
    case "Property":
      return "Property"
    case "Pension":
    case "Insurance":
    case "Defined Contribution":
    case "Superannuation":
    case "Annuity":
    case "Policy":
    case "Retirement Fund":
      return "Retirement"
    default:
      return "Other"
  }
}

export interface WealthSummary {
  totalValue: number
  totalGainOnDay: number
  portfolioCount: number
  classificationBreakdown: {
    classification: string
    value: number
    percentage: number
  }[]
  portfolioBreakdown: {
    code: string
    name: string
    value: number
    percentage: number
    irr: number
  }[]
}

// Color palette for charts
export const COLORS = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
]

export const LIQUIDITY_COLORS: Record<string, string> = {
  Investment: "#3B82F6", // blue
  Cash: "#10B981", // emerald
  Property: "#F59E0B", // amber
  Retirement: "#8B5CF6", // violet
  Other: "#6B7280", // gray
}
