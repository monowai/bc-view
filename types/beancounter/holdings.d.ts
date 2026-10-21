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
  viewTotals: MoneyValues
  totals: Total
}

export interface GroupKey {
  groupKey: string
}

// User defined grouping
export interface HoldingGroup {
  positions: Position[]
  subTotals: Record<ValueIn, MoneyValues>
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

export interface MoneyValues {
  dividends: number
  costValue: number
  fees: number
  tax: number
  cash: number // separate out cash into its own bucket
  /** Cash reserved for pending/unsettled settlement; marketValue + earmarked = nominal */
  earmarked: number
  purchases: number
  sales: number
  costBasis: number
  averageCost: number
  realisedGain: number
  unrealisedGain: number
  gainOnDay: number
  totalGain: number
  priceData: PriceData
  marketValue: number
  currency: Currency
  valueIn: ValueIn
  weight: number
  roi: number
  irr: number
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
  subTotals: Record<ValueIn, MoneyValues>
  valueIn: ValueIn
}

export interface HoldingsInCurrency {
  holdings: Holdings
  valueIn: ValueIn
}
