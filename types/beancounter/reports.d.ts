import type { Currency } from "./asset"

// ============ Monthly Income Report ============

/**
 * Monthly income data for a single month.
 */
export interface MonthlyIncomeData {
  yearMonth: string
  income: number
}

/**
 * Individual asset that contributed to income within a group.
 */
export interface IncomeContributor {
  assetId: string
  assetCode: string
  assetName?: string
  totalIncome: number
}

/**
 * Income data aggregated by a grouping (assetClass, sector, currency, or market).
 */
export interface IncomeGroupData {
  groupKey: string
  totalIncome: number
  monthlyData: MonthlyIncomeData[]
  topContributors: IncomeContributor[]
}

/**
 * Response from the monthly income API.
 */
export interface MonthlyIncomeResponse {
  startMonth: string
  endMonth: string
  currency: string
  totalIncome: number
  groupBy: string
  months: MonthlyIncomeData[]
  groups: IncomeGroupData[]
}

// Performance / TWR types
export interface PerformanceDataPoint {
  date: string
  growthOf1000: number
  marketValue: number
  netContributions: number
  cumulativeReturn: number
  cumulativeDividends: number
}

export interface PerformanceData {
  currency: Currency
  series: PerformanceDataPoint[]
  firstTradeDate?: string // ISO date, null on cache hits
}

export interface PerformanceResponse {
  data: PerformanceData
}

// ── Net worth (svc-position GET /net-worth) ─────────────────────────────────
// The headline is computed server-side: every value is already in `currency`.
// The browser renders it and must not re-derive it from holdings.

export interface NetWorthClassification {
  classification: string
  value: number
  percentage: number
}

export interface NetWorthPortfolio {
  id: string
  code: string
  name: string
  value: number
  percentage: number
  irr: number
}

export interface NetWorth {
  asAt: string
  currency: string
  totalValue: number
  holdingsValue: number
  standaloneCompositeValue: number
  healthcareReserve: number
  gainOnDay: number
  portfolioCount: number
  /** Sorted by value, descending. */
  classificationBreakdown: NetWorthClassification[]
  portfolios: NetWorthPortfolio[]
}

export interface NetWorthResponse {
  data: NetWorth
}
