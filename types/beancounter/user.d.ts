export interface SystemUser {
  id: string
  active: boolean
  email: string | undefined
  since: string
  // Per-user default funding portfolio for cash auto-settle. undefined
  // (or absent) means no account-wide default — falls through to per-portfolio
  // override; if both are unset, auto-settle is disabled.
  cashPortfolioId?: string
}

export interface Registration {
  id: string
  email: string
  active: boolean
  since: string
}

export type HoldingsView =
  "SUMMARY" | "TABLE" | "CARDS" | "HEATMAP" | "ALLOCATION"

// Type aliases for UserPreferences - runtime values defined in types/constants.ts
export type ValueInOption = "PORTFOLIO" | "BASE" | "TRADE"

// Backend GroupBy API values (enum names as persisted in the database)
export type GroupByApiValue =
  "ASSET_CLASS" | "SECTOR" | "MARKET_CURRENCY" | "MARKET"

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
  enableTwr: boolean
  hideValues?: boolean // Privacy mode - hide monetary values and quantities
  defaultMarket?: string // Default market for asset search (e.g., "US", "NZX")
  milestoneMode?: "ACTIVE" | "SILENT" | "OFF" // Milestone notification mode
  // Profile demographics mirrored from svc-retire's UserIndependenceSettings
  // so screens scoped to svc-data (Edit Asset, holdings) can resolve current
  // age without a runtime call to svc-retire.
  yearOfBirth?: number
  monthOfBirth?: number
  lifeExpectancy?: number
  // Enter-Payslip defaults: last portfolio + cash asset used so the dialog
  // can prefill on the next pay run.
  defaultPayslipPortfolioId?: string | null
  defaultPayslipCashAssetId?: string | null
  // Zen mode collapses multi-portfolio chrome (pickers, aggregate drill-downs)
  // for single-portfolio users. Currently derived from portfolio count; this
  // optional flag is the forward hook for an explicit SystemUser property that
  // will override the derivation once the backend exposes it. See
  // `@lib/user/zenMode`.
  zenMode?: boolean
}

export interface UserPreferencesRequest {
  preferredName?: string
  defaultHoldingsView?: HoldingsView
  defaultValueIn?: ValueInOption
  defaultGroupBy?: GroupByApiValue // Send enum names to backend
  baseCurrencyCode?: string
  reportingCurrencyCode?: string
  showWeightedIrr?: boolean
  enableTwr?: boolean
  hideValues?: boolean
  defaultMarket?: string
  milestoneMode?: "ACTIVE" | "SILENT" | "OFF"
  yearOfBirth?: number
  monthOfBirth?: number
  lifeExpectancy?: number
  defaultPayslipPortfolioId?: string | null
  defaultPayslipCashAssetId?: string | null
}

export interface RegistrationResponse {
  data: Registration
  preferences?: UserPreferences
}

// ============ Offboarding ============

/**
 * Summary of user's data that can be deleted during offboarding.
 */
export interface OffboardingSummary {
  portfolioCount: number
  assetCount: number
  taxRateCount: number
  brokerCount: number
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

// ============ API Keys (BC-issued, for external agent/MCP access) ============

export interface ApiKey {
  id: string
  name: string
  /** First 11 characters of the key, e.g. "bc_a1b2c3d4" — for display only. */
  prefix: string
  scopes: string[]
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
}

export interface ApiKeyRequest {
  name: string
  scopes: string[]
  expiresAt?: string
}

export interface ApiKeysResponse {
  data: ApiKey[]
}

/** Response from POST /me/api-keys — `apiKey` is the raw key, shown only here. */
export interface ApiKeyCreatedResponse {
  data: ApiKey
  apiKey: string
}

export interface ApiKeyResponse {
  data: ApiKey
}
