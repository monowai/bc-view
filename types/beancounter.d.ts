import { ValueIn } from "@components/features/holdings/GroupByOptions"

export type TrnType =
  | "BUY"
  | "SELL"
  | "DIVI"
  | "SPLIT"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "INCOME"
  | "DEDUCTION"
  | "FX"
  | "FX_BUY"
  | "ADD"
  | "REDUCE"
  | "BALANCE"
  | "COST_ADJUST"

export type TrnStatus = "PROPOSED" | "SETTLED"

export interface QuickSellData {
  asset: string
  market: string
  quantity: number
  price: number
  type?: "BUY" | "SELL"
  currentPositionQuantity?: number // For rebalance: the current position size
}

export interface RebalanceData {
  asset: string
  market: string
  quantity: number
  price: number
  type: "BUY" | "SELL"
  currentPositionQuantity: number
}

export interface WeightClickData {
  asset: Asset
  currentWeight: number
  currentQuantity: number
  currentPrice: number
}

export interface SetCashBalanceData {
  currency: string // Currency code (e.g., "USD", "NZD")
  currentBalance: number // Current cash balance
  market?: string // Market code: "CASH" for currencies, "PRIVATE" for bank accounts
  assetCode?: string // Asset code for bank accounts (e.g., "WISE", "USD-SAVINGS")
  assetName?: string // Asset name for display
}

export interface CashTransferData {
  portfolioId: string
  portfolioCode: string
  assetId: string
  assetCode: string
  assetName: string
  currency: string
  currentBalance: number
}

export interface SetPriceData {
  asset: Asset
}

export interface CostAdjustData {
  asset: Asset
  portfolioId: string
  currentCostBasis: number // Current cost basis for reference
  currency: Currency // Trade currency for the position
}

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
  currency: Currency
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
  weightedIrr: number
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

export interface DateValues {
  opened
  last
  closed
  lastDividend
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
  active?: boolean // Defaults to true if not specified
  currency: Currency
  base: Currency
  owner?: SystemUser
  marketValue: number
  irr: number
  gainOnDay?: number
  assetClassification?: Record<string, number>
  valuedAt?: string // ISO date string (YYYY-MM-DD)
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
  active?: boolean
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
  active?: boolean
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
  cashCurrency?: string
  cashAssetId?: string // Settlement account asset ID
  cashAmount: number
  tradeCashRate: number
  fees: number
  tax: number
}

interface TradeFormData {
  type: { value: string; label: string }
  status?: { value: string; label: string }
  asset: string
  market: string
  tradeDate: string
  quantity: number
  price: number
  tradeCurrency: {
    value: string
    label: string
    currency?: string
    market?: string
  }
  cashCurrency?: {
    value: string
    label: string
    currency?: string
    market?: string
  }
  settlementAccount?: { value: string; label: string; currency: string } // Asset ID, display label, and currency
  tradeAmount?: number
  cashAmount?: number
  fees: number
  tax: number
  comments: string | undefined
}

interface CallerRef {
  provider: string
  batch: string
  callerId: string
}

export interface Transaction {
  id: string
  callerRef: CallerRef
  trnType: TrnType
  status: TrnStatus
  portfolio: Portfolio
  asset: Asset
  cashAsset?: Asset // Settlement account asset
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
  broker?: Broker
}

interface Registration {
  id: string
  email: string
  active: boolean
  since: string
}

export type HoldingsView =
  | "SUMMARY"
  | "TABLE"
  | "CARDS"
  | "HEATMAP"
  | "ALLOCATION"

// Type aliases for UserPreferences - runtime values defined in types/constants.ts
export type ValueInOption = "PORTFOLIO" | "BASE" | "TRADE"

// Backend GroupBy API values (enum names as persisted in the database)
export type GroupByApiValue =
  | "ASSET_CLASS"
  | "SECTOR"
  | "MARKET_CURRENCY"
  | "MARKET"

// Frontend GroupBy property paths (used for client-side grouping)
export type GroupByOption =
  | "asset.assetCategory.name"
  | "asset.sector"
  | "asset.market.currency.code"
  | "asset.market.code"

export interface UserPreferences {
  id: string
  preferredName?: string
  defaultHoldingsView: HoldingsView
  defaultValueIn: ValueInOption
  defaultGroupBy: GroupByApiValue // Backend stores enum names
  baseCurrencyCode: string // System base currency for cost tracking
  reportingCurrencyCode: string // Default currency for displaying values
  showWeightedIrr: boolean
  hideValues?: boolean // Privacy mode - hide monetary values and quantities
}

export interface UserPreferencesRequest {
  preferredName?: string
  defaultHoldingsView?: HoldingsView
  defaultValueIn?: ValueInOption
  defaultGroupBy?: GroupByApiValue // Send enum names to backend
  baseCurrencyCode?: string
  reportingCurrencyCode?: string
  showWeightedIrr?: boolean
  hideValues?: boolean
}

export interface RegistrationResponse {
  data: Registration
  preferences?: UserPreferences
}

export interface Market {
  code: string
  name: string
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
  priceSymbol?: string // Currency code for ACCOUNT/CASH assets
  reportCategory?: string // Higher-level category for reporting (nullable, for backward compatibility)
  effectiveReportCategory?: string // Computed: reportCategory if set, otherwise mapped from assetCategory
  sector?: string // Sector classification (e.g., "Technology", "Health Care")
  industry?: string // Industry classification (more granular than sector)
  expectedReturnRate?: number // Expected annual return rate (decimal, e.g., 0.03 for 3%)
}

export interface AssetCategory {
  id: string
  name: string
}

// Asset category constants
export const ASSET_CATEGORIES = {
  EQUITY: "EQUITY",
  CASH: "CASH",
  ETF: "ETF",
  MUTUAL_FUND: "MUTUAL FUND",
  RE: "RE",
  ACCOUNT: "ACCOUNT",
  TRADE: "TRADE",
  PENSION: "PENSION",
} as const

export type AssetCategoryId =
  (typeof ASSET_CATEGORIES)[keyof typeof ASSET_CATEGORIES]

// Input for creating/updating assets
export interface AssetInput {
  market: string
  code: string
  name?: string
  currency?: string
  category: string
  owner: string
  expectedReturnRate?: number // Expected annual return rate (decimal, e.g., 0.03 for 3%)
}

// Request wrapper for bulk asset operations
export interface AssetRequest {
  data: Record<string, AssetInput>
}

// Response from asset creation
export interface AssetResponse {
  data: Record<string, Asset>
}

// Asset search result from backend search
export interface AssetSearchResult {
  symbol: string
  name: string
  type: string
  region?: string
  currency?: string
  market?: string
  assetId?: string
}

// Response from asset search
export interface AssetSearchResponse {
  data: AssetSearchResult[]
}

export interface PriceData {
  change: number
  close: number
  previousClose: number
  changePercent: number
  priceDate: string
}

export interface CorporateEvent {
  id: string
  trnType: TrnType
  source: string
  assetId: string
  recordDate: string
  rate: number
  split: number
  payDate: string
}

export interface CorporateEventResponse {
  data: CorporateEvent
}

export interface CorporateEventsResponse {
  data: CorporateEvent[]
}

// FX Rate types
export interface FxRate {
  from: Currency
  to: Currency
  rate: number
  date: string
}

export interface FxPairResults {
  rates: Record<string, FxRate>
}

export interface FxResponse {
  data: FxPairResults
}

export interface FxRequest {
  rateDate?: string
  pairs: Array<{ from: string; to: string }>
  provider?: string // Optional: FRANKFURTER, EXCHANGE_RATES_API, or undefined for composite
}

export interface FxProvidersResponse {
  providers: string[]
}

// Asset Allocation types
export interface CategoryAllocation {
  category: string
  marketValue: number
  percentage: number
}

export interface AllocationData {
  cashAllocation: number
  equityAllocation: number
  housingAllocation: number
  totalValue: number
  currency: string
  categoryBreakdown: Record<string, CategoryAllocation>
}

export interface AllocationResponse {
  data: AllocationData
}

// Classification types for sector/industry grouping
export interface AssetClassificationSummary {
  assetId: string
  sector?: string
  industry?: string
}

export interface BulkClassificationRequest {
  assetIds: string[]
}

export interface BulkClassificationResponse {
  data: Record<string, AssetClassificationSummary>
}

// ETF Sector Exposure types
export interface SectorExposure {
  item: {
    name: string
    code: string
  }
  weight: number
  asOf: string
}

export interface SectorExposuresResponse {
  data: SectorExposure[]
}

// ETF Top Holdings types
export interface AssetHolding {
  symbol: string
  name?: string
  weight: number
  asOf: string
}

export interface AssetHoldingsResponse {
  data: AssetHolding[]
}

// ============ Private Asset Config ============

/**
 * Configuration for private assets (Real Estate, etc.).
 * Stores income assumptions, expenses, and planning parameters.
 */
export interface PrivateAssetConfig {
  assetId: string
  // Income settings
  monthlyRentalIncome: number
  rentalCurrency: string
  // Country code for tax jurisdiction (ISO 3166-1 alpha-2, e.g., "NZ", "SG")
  countryCode: string
  // Expense settings - management
  monthlyManagementFee: number
  managementFeePercent: number
  // Expense settings - property costs
  monthlyBodyCorporateFee: number
  annualPropertyTax: number
  annualInsurance: number
  monthlyOtherExpenses: number
  // Tax settings - when true, deduct income tax using rate from user's country config
  deductIncomeTax: boolean
  // Planning settings
  isPrimaryResidence: boolean
  liquidationPriority: number
  // Transaction generation settings
  transactionDayOfMonth: number
  creditAccountId?: string
  autoGenerateTransactions: boolean
  // Pension/Policy payout settings
  expectedReturnRate?: number
  payoutAge?: number
  monthlyPayoutAmount?: number
  lumpSumPayoutAmount?: number
  isPension: boolean
  // Timestamps
  createdDate: string
  updatedDate: string
}

export interface PrivateAssetConfigRequest {
  monthlyRentalIncome?: number
  rentalCurrency?: string
  countryCode?: string
  monthlyManagementFee?: number
  managementFeePercent?: number
  monthlyBodyCorporateFee?: number
  annualPropertyTax?: number
  annualInsurance?: number
  monthlyOtherExpenses?: number
  deductIncomeTax?: boolean
  isPrimaryResidence?: boolean
  liquidationPriority?: number
  transactionDayOfMonth?: number
  creditAccountId?: string
  autoGenerateTransactions?: boolean
  // Pension/Policy payout settings
  expectedReturnRate?: number
  payoutAge?: number
  monthlyPayoutAmount?: number
  lumpSumPayoutAmount?: number
  isPension?: boolean
}

export interface PrivateAssetConfigResponse {
  data: PrivateAssetConfig
}

export interface PrivateAssetConfigsResponse {
  data: PrivateAssetConfig[]
}

// ============ Tax Rates ============

/**
 * User-defined tax rate for a country.
 * Used to calculate income tax on rental properties.
 */
export interface TaxRate {
  countryCode: string
  rate: number // Decimal (e.g., 0.20 for 20%)
}

export interface TaxRateRequest {
  countryCode: string
  rate: number
}

export interface TaxRateResponse {
  data: TaxRate
}

export interface TaxRatesResponse {
  data: TaxRate[]
}

// ============ Offboarding ============

/**
 * Summary of user's data that can be deleted during offboarding.
 */
export interface OffboardingSummary {
  portfolioCount: number
  assetCount: number
  taxRateCount: number
}

/**
 * Result of a deletion operation during offboarding.
 */
export interface OffboardingResult {
  success: boolean
  deletedCount: number
  type: string
  message?: string
}

// ============ Brokers ============

/**
 * Broker/custodian where transactions are held.
 */
export interface Broker {
  id: string
  name: string
  accountNumber?: string
  notes?: string
}

export interface BrokerInput {
  name: string
  accountNumber?: string
  notes?: string
}

export interface BrokerResponse {
  data: Broker
}

export interface BrokersResponse {
  data: Broker[]
}

/**
 * A single transaction for broker reconciliation drill-down.
 */
export interface BrokerHoldingTransaction {
  id: string
  portfolioId: string
  portfolioCode: string
  tradeDate: string
  trnType: string
  quantity: number
  price: number
  tradeAmount: number
}

/**
 * Transactions grouped by portfolio for a specific asset.
 */
export interface BrokerPortfolioGroup {
  portfolioId: string
  portfolioCode: string
  quantity: number
  transactions: BrokerHoldingTransaction[]
}

/**
 * A position held with a broker for reconciliation purposes.
 */
export interface BrokerHoldingPosition {
  assetId: string
  assetCode: string
  assetName?: string
  market: string
  quantity: number
  portfolioGroups: BrokerPortfolioGroup[]
}

/**
 * Response containing all holdings for a specific broker.
 */
export interface BrokerHoldingsResponse {
  brokerId: string
  brokerName: string
  holdings: BrokerHoldingPosition[]
}
