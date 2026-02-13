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
