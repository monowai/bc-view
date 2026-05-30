import type { Portfolio } from "types/beancounter"

/**
 * Asset-classification keys representing PRIVATE-market real estate —
 * the user's own home and similar non-marketable property. Public
 * RE products (REITs, RE-ETFs) classify as Equity / ETF and stay liquid.
 *
 * Mirrors svc-retire's HOUSING_CATEGORIES (svc-position AllocationService)
 * and NON_SPENDABLE_CATEGORIES (svc-retire CalculationService).
 */
const ILLIQUID_CATEGORY_KEYS = new Set<string>([
  "Property", // REPORT_PROPERTY (svc-position effectiveReportCategory)
  "Real Estate", // raw category name fallback
  "RE", // raw asset category id (AssetCategory.RE)
])

/**
 * Returns false when the portfolio has any PRIVATE+RE exposure.
 *
 * Any non-zero entry under an illiquid category key disqualifies the
 * portfolio from Wealth Performance — illiquid valuations move on
 * appraisal cycles, not market prices, and pollute aggregate TWR even
 * when commingled with marketable assets. Portfolios with no
 * `assetClassification` (legacy / unvalued) are treated as liquid.
 */
export function isLiquidPortfolio(portfolio: Portfolio): boolean {
  const classification = portfolio.assetClassification
  if (!classification) return true
  for (const key of ILLIQUID_CATEGORY_KEYS) {
    const value = classification[key]
    if (value !== undefined && value > 0) return false
  }
  return true
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
    case "Policies":
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
