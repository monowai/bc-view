import { Asset } from "types/beancounter"

/**
 * Report category constants for higher-level grouping.
 * These consolidate detailed categories into broader groups for reporting.
 */
export const REPORT_CATEGORIES = {
  CASH: "Cash",
  EQUITY: "Equity",
  ETF: "ETF",
  MUTUAL_FUND: "Mutual Fund",
  PROPERTY: "Property",
} as const

export type ReportCategory =
  (typeof REPORT_CATEGORIES)[keyof typeof REPORT_CATEGORIES]

/**
 * Maps a detailed asset category to a higher-level report category.
 * Used for backward compatibility when effectiveReportCategory is not available.
 */
export function mapToReportCategory(categoryId: string): string {
  const upperCategory = categoryId.toUpperCase()

  switch (upperCategory) {
    case "CASH":
    case "ACCOUNT":
    case "TRADE":
    case "BANK ACCOUNT":
      return REPORT_CATEGORIES.CASH
    case "EQUITY":
      return REPORT_CATEGORIES.EQUITY
    case "RE":
    case "REAL ESTATE":
      return REPORT_CATEGORIES.PROPERTY
    case "EXCHANGE TRADED FUND":
    case "ETF":
      return REPORT_CATEGORIES.ETF
    case "MUTUAL FUND":
      return REPORT_CATEGORIES.MUTUAL_FUND
    default:
      // Default: return original category as-is
      return categoryId
  }
}

/**
 * Gets the report category for an asset.
 * Uses effectiveReportCategory from backend if available,
 * otherwise falls back to client-side mapping for backward compatibility.
 *
 * @param asset The asset to get the report category for
 * @returns The report category string
 */
export function getReportCategory(asset: Asset): string {
  // Use backend-computed value if available
  if (asset.effectiveReportCategory) {
    return asset.effectiveReportCategory
  }

  // Fall back to client-side mapping for backward compatibility
  // Use .name (e.g., "Exchange Traded Fund") as that's what the original grouping used
  const categoryName =
    asset.assetCategory?.name || asset.assetCategory?.id || "Equity"
  return mapToReportCategory(categoryName)
}

/**
 * Sort order for report categories in holdings display.
 * Categories not in this list will appear at the end.
 */
export const REPORT_CATEGORY_SORT_ORDER = [
  REPORT_CATEGORIES.EQUITY,
  REPORT_CATEGORIES.ETF,
  REPORT_CATEGORIES.MUTUAL_FUND,
  REPORT_CATEGORIES.PROPERTY,
  REPORT_CATEGORIES.CASH,
]

/**
 * Comparator function for sorting by report category.
 */
export function compareByReportCategory(a: string, b: string): number {
  const indexA = REPORT_CATEGORY_SORT_ORDER.indexOf(a as ReportCategory)
  const indexB = REPORT_CATEGORY_SORT_ORDER.indexOf(b as ReportCategory)

  // Categories not in sort order go to the end
  const effectiveIndexA =
    indexA === -1 ? REPORT_CATEGORY_SORT_ORDER.length : indexA
  const effectiveIndexB =
    indexB === -1 ? REPORT_CATEGORY_SORT_ORDER.length : indexB

  return effectiveIndexA - effectiveIndexB
}

/**
 * Comparator function for sorting by sector.
 * Ordering: Classified sectors (alphabetically) → Unclassified → Cash (always last)
 */
export function compareBySector(a: string, b: string): number {
  // Cash is always last
  if (a === "Cash") return 1
  if (b === "Cash") return -1
  // Unclassified comes before Cash but after everything else
  if (a === "Unclassified") return 1
  if (b === "Unclassified") return -1
  // Everything else alphabetically
  return a.localeCompare(b)
}
