import { ValueInOption as ValueIn } from "../constants"
import type { Asset, Currency } from "./asset"
import type { PriceData } from "./marketData"
import type { Portfolio } from "./portfolio"

// As returned from the server
export interface HoldingContract {
  portfolio: Portfolio
  isMixedCurrencies: boolean // Mixed trade currencies?
  asAt: string
  positions: Record<string, Position>
  totals: Record<ValueIn, Total>
}

// The payload we render in the UI
export interface Holdings {
  holdingGroups: Record<string, HoldingGroup>
  currency: Currency
  portfolio: Portfolio
  valueIn: ValueIn
  viewTotals: SubTotalValues
  totals: Total
}

export interface GroupKey {
  groupKey: string
}

// User defined grouping
export interface HoldingGroup {
  positions: Position[]
  subTotals: Record<ValueIn, SubTotalValues>
}

export interface Total {
  marketValue: number
  purchases: number
  sales: number
  cash: number
  income: number
  gain: number
  irr: number
  currency: Currency
}

export interface HoldingValues {
  portfolio: Portfolio
  groupBy: string
  holdingGroup: HoldingGroup
  valueIn: ValueIn
}

/**
 * Per-bucket money values exactly as svc-position sends them
 * (jar-contracts `MoneyValues`). Every field has a server default, so all are
 * always present.
 */
export interface MoneyValues {
  currency: Currency
  dividends: number
  expenses: number
  costValue: number
  costBasis: number
  fees: number
  purchases: number
  sales: number
  marketValue: number
  /** Cash reserved for pending/unsettled settlement; marketValue + earmarked = nominal */
  earmarked: number
  weight: number
  irr: number
  roi: number
  priceData: PriceData
  averageCost: number
  realisedGain: number
  unrealisedGain: number
  totalGain: number
  gainOnDay: number
}

/**
 * Group subtotals and view totals summed in the browser by calculateHoldings.
 * Not a server type: `weightedIrr` exists only here.
 */
export interface SubTotalValues {
  currency: Currency
  costValue: number
  marketValue: number
  dividends: number
  purchases: number
  sales: number
  realisedGain: number
  unrealisedGain: number
  totalGain: number
  gainOnDay: number
  weight: number
  /** Market-value-weighted IRR of the group's tradeable positions */
  weightedIrr: number
}

export interface QuantityValues {
  sold: number
  purchased: number
  total: number
  precision: number
}

export interface PortfolioBreakdown {
  portfolioId: string
  portfolioCode: string
  portfolioName: string
  quantity: number
  held?: Record<string, number> // Broker name -> quantity within THIS portfolio
}

export interface PortfolioBreakdownData {
  asset: Asset
  breakdown: PortfolioBreakdown[]
}

export interface PriceChartData {
  asset: Asset
  currencySymbol: string
  portfolioId: string
}

export interface Position {
  asset: Asset
  moneyValues: Record<ValueIn, MoneyValues>
  quantityValues: QuantityValues
  dateValues: DateValues
  lastTradeDate: string
  roi: number
  held?: Record<string, number> // Broker name -> quantity held
  subAccounts?: Record<string, number>
  portfolioBreakdown?: PortfolioBreakdown[]
}

// ISO dates (yyyy-MM-dd); svc-position sends null until the event has happened
export interface DateValues {
  firstTransaction: string | null
  opened: string | null
  last: string | null
  closed: string | null
  lastDividend: string | null
}

export interface GroupedSubtotals {
  groupBy: string
  subTotals: Record<ValueIn, SubTotalValues>
  valueIn: ValueIn
}

export interface HoldingsInCurrency {
  holdings: Holdings
  valueIn: ValueIn
}
