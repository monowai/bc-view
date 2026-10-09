import type { NetWorth } from "types/beancounter"
import type { WealthSummary } from "@lib/wealth/liquidityGroups"

export type SortConfig = {
  key: string | null
  direction: "asc" | "desc"
}

type PortfolioRow = WealthSummary["portfolioBreakdown"][number]

/** What a view renders before the endpoint answers, or when nothing is in scope. */
export const EMPTY_WEALTH_SUMMARY: WealthSummary = {
  totalValue: 0,
  totalGainOnDay: 0,
  portfolioCount: 0,
  healthcareReserve: 0,
  classificationBreakdown: [],
  portfolioBreakdown: [],
}

/**
 * Orders the portfolio rows for the details table. Lifted unchanged from the
 * old client-side summary hook; the only thing the browser still decides.
 */
export function comparePortfolioRows(
  sortConfig: SortConfig,
): (a: PortfolioRow, b: PortfolioRow) => number {
  return (a, b) => {
    if (!sortConfig.key) return 0
    let aVal: string | number
    let bVal: string | number
    switch (sortConfig.key) {
      case "code":
        aVal = a.code.toLowerCase()
        bVal = b.code.toLowerCase()
        break
      case "value":
        aVal = a.value
        bVal = b.value
        break
      case "percentage":
        aVal = a.percentage
        bVal = b.percentage
        break
      case "irr":
        aVal = a.irr
        bVal = b.irr
        break
      default:
        return 0
    }
    if (typeof aVal === "string" && typeof bVal === "string") {
      const result = aVal.localeCompare(bVal)
      return sortConfig.direction === "asc" ? result : -result
    }
    const result = (aVal as number) - (bVal as number)
    return sortConfig.direction === "asc" ? result : -result
  }
}

/**
 * Adapts svc-position's net-worth payload to the `WealthSummary` shape the
 * wealth components render. Pure field mapping plus the table sort — every
 * number is the server's.
 */
export function toWealthSummary(
  netWorth: NetWorth,
  sortConfig: SortConfig,
): WealthSummary {
  const portfolioBreakdown = netWorth.portfolios
    .map((p) => ({
      code: p.code,
      name: p.name,
      value: p.value,
      percentage: p.percentage,
      irr: p.irr,
    }))
    .sort(comparePortfolioRows(sortConfig))

  return {
    totalValue: netWorth.totalValue,
    totalGainOnDay: netWorth.gainOnDay,
    portfolioCount: netWorth.portfolioCount,
    healthcareReserve: netWorth.healthcareReserve,
    classificationBreakdown: netWorth.classificationBreakdown,
    portfolioBreakdown,
  }
}
