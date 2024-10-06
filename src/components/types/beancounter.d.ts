import { ValueIn } from "@components/holdings/GroupByOptions"

export type TrnType = "BUY" | "SELL" | "DIVI" | "SPLIT"

// As returned from the server
interface HoldingContract {
  portfolio: Portfolio
  isMixedCurrencies: boolean // Mixed trade currencies?
  asAt: string
  positions: Record<string, Position>
  totals: Record<ValueIn, Total>
}

// The payload we render in the UI
interface Holdings {
  holdingGroups: Record<string, HoldingGroup>
  currency: Currency
  portfolio: Portfolio
  valueIn: ValueIn
  viewTotals: MoneyValues
  totals: Total
}

interface GroupKey {
  groupKey: string
}

// User defined grouping
interface HoldingGroup {
  positions: Position[]
  subTotals: MoneyValues[ValueIn]
}

interface Total {
  marketValue: number
  purchases: number
  sales: number
  cash: number
  income: number
  gain: number
  irr: number
  currency: Currency | undefined
}

export interface HoldingValues {
  portfolio: Portfolio
  groupBy: string
  holdingGroup: HoldingGroup
  valueIn: ValueIn
}

export interface MoneyValues {
  [index: ValueIn]: MoneyValues

  dividends: number
  costValue: number
  fees: number
  tax: number
  cash: number // separate out cash into its own bucket
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
  valueIn: ValuationCcy
  weight: number
  roi: number
  irr: number
}

export interface QuantityValues {
  sold: number
  purchased: number
  total: number
  precision: number
}

export interface Position {
  [index: string]: ValueIn

  asset: Asset
  moneyValues: MoneyValues[ValueIn]
  quantityValues: QuantityValues
  dateValues: DateValues
  lastTradeDate: string
  roi: number
}

export interface GroupedSubtotals {
  groupBy: string
  subTotals: Record<ValueIn, MoneyValues>
  valueIn: ValueIn
}

export interface Portfolio {
  id: string
  code: string
  name: string
  currency: Currency
  base: Currency
  owner?: SystemUser
  marketValue: number
  irr: number
}

export interface PortfolioResponse {
  data: Portfolio
}

export interface PortfolioResponses {
  data: Portfolio[]
}

export interface PortfolioRequest {
  code: string
  name: string
  currency: string
  base: string
}

export interface PortfolioRequests {
  data: PortfolioRequest[]
}

export interface PortfolioSummary {
  totals: Total
  currency: Currency
}

export interface PortfolioInput {
  code: string
  name: string
  currency: CurrencyOption
  base: CurrencyOption
}

export interface CurrencyOption {
  label: string
  value: string
}

// Server side contract
interface TransactionImport {
  portfolio: Portfolio
  purge: boolean
}

interface HoldingsInCurrency {
  holdings: Holdings
  valueIn: ValuationCcy
}

interface SystemUser {
  id: string
  active: boolean
  email: string | undefined
  since: string
}

interface TrnInput {
  trnType: TrnType
  portfolioId: string
  assetId: string
  tradeDate: string
  quantity: number
  price: number
  tradeCurrency: string
  tradeAmount: number
  tradeBaseRate: number
  tradePortfolioRate: number
  cashCurrency: string
  cashAmount: number
  tradeCashRate: number
  fees: number
  tax: number
}

interface CallerRef {
  provider: string
  batch: string
  callerId: string
}

interface Transaction {
  id: string
  callerRef: CallerRef
  trnType: TrnType
  portfolio: Portfolio
  asset: Asset
  tradeDate: string
  quantity: number
  price: number
  tradeCurrency: Currency
  tradeAmount: number
  tradeBaseRate: number
  tradePortfolioRate: number
  cashCurrency: string
  cashAmount: number
  tradeCashRate: number
  fees: number
  tax: number
  comments: string
}

interface Registration {
  id: string
  email: string
  active: boolean
  since: string
}

export interface RegistrationResponse {
  data: Registration
}

export interface Market {
  code: string
  currency: Currency
}

export interface Currency {
  code: string
  name: string
  symbol: string
}

export interface Asset {
  id: string
  code: string
  name: string
  assetCategory: AssetCategory
  market: Market
}

export interface AssetCategory {
  id: string
  name: string
}

export interface PriceData {
  change: number
  close: number
  previousClose: number
  changePercent: number
  priceDate: string
}
