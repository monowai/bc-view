export interface CurrencyOption {
  label: string
  value: string
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

export interface AccountingType {
  id: string
  category: string
  currency: Currency
  boardLot?: number
  settlementDays?: number
}

export interface Asset {
  id: string
  code: string
  name: string
  assetCategory: AssetCategory
  market: Market
  priceSymbol?: string // Currency code for ACCOUNT/CASH assets
  accountingType?: AccountingType // V11: replaces priceSymbol for CASH/PRIVATE assets
  status?: string // "Active" | "Inactive"
  reportCategory?: string // Higher-level category for reporting (nullable, for backward compatibility)
  effectiveReportCategory?: string // Computed: reportCategory if set, otherwise mapped from assetCategory
  sector?: string // Sector classification (e.g., "Technology", "Health Care")
  industry?: string // Industry classification (more granular than sector)
  expectedReturnRate?: number // Expected annual return rate (decimal, e.g., 0.03 for 3%)
  classificationCheckedAt?: string // ISO date: last time a classification provider was checked for this asset, even when it returned nothing
  // Read-only traits svc-data derives (AssetTraits); read them, never re-derive.
  chartable: boolean // Has a market price worth charting
  watchable: boolean // Can go on a watchlist
  hasNews: boolean // News, and an AI review built on it, can be found
  displayCode: string // The code a user reads: private owner prefix dropped
  cashLike: boolean // Currency cash or a bank account (category CASH or ACCOUNT)
}

export interface AssetCategory {
  id: string
  name: string
}

// Asset category ids svc-data knows
export type AssetCategoryId =
  | "EQUITY"
  | "CASH"
  | "ETF"
  | "MUTUAL FUND"
  | "RE"
  | "ACCOUNT"
  | "TRADE"
  | "POLICY"

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

// Shared option type for asset search dropdowns (react-select)
export interface AssetOption {
  value: string
  label: string
  symbol: string
  name?: string
  market?: string
  assetId?: string
  currency?: string
  type?: string
  region?: string
  // A search hit's read-only traits; absent on an option built from a bare code.
  chartable?: boolean
  watchable?: boolean
  hasNews?: boolean
  displayCode?: string
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
  // Read-only traits, as on Asset.
  chartable: boolean
  watchable: boolean
  hasNews: boolean
  displayCode: string
}

// Response from asset search
export interface AssetSearchResponse {
  data: AssetSearchResult[]
}
