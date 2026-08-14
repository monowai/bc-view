// Rebalance feature TypeScript types

// Enums
export type RebalanceScenario = "INVEST_CASH" | "REBALANCE"
export type ModelPlanStatus = "DRAFT" | "APPROVED"
/** Allocation method for distributing cash investments */
export type AllocationMethod = "TARGET_WEIGHT" | "RETURN_ADJUSTED"

// Model Types (new structure - Model is metadata only, weights are in Plans)
export interface ModelDto {
  id: string
  name: string
  objective?: string
  description?: string
  baseCurrency: string
  /** Risk profile 1 (lowest) – 5 (highest); shown as stars. */
  risk: number
  shared: boolean
  clientId?: string
  isOwner: boolean
  currentPlanId?: string
  currentPlanVersion?: number
  planCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateModelRequest {
  name: string
  objective?: string
  description?: string
  baseCurrency?: string
  clientId?: string
  /** Risk profile 1 (lowest) – 5 (highest). */
  risk?: number
}

export interface UpdateModelRequest {
  name: string
  objective?: string
  description?: string
  baseCurrency?: string
  shared?: boolean
  /** Risk profile 1 (lowest) – 5 (highest). */
  risk?: number
}

// Plan Types (new structure)
export interface PlanAssetInput {
  assetId: string
  weight: number
  /** Asset code in MARKET:CODE format (e.g., NASDAQ:VOO) */
  assetCode?: string
  capturedPrice?: number
  priceCurrency?: string
  rationale?: string
  sortOrder?: number
}

export interface PlanAssetDto {
  id: string
  assetId: string
  assetCode?: string
  assetName?: string
  weight: number
  capturedPrice?: number
  priceCurrency?: string
  rationale?: string
  sortOrder: number
}

export interface PlanDto {
  id: string
  modelId: string
  modelName: string
  version: number
  description?: string
  status: ModelPlanStatus
  assets: PlanAssetDto[]
  cashWeight: number
  createdAt: string
  approvedAt?: string
  updatedAt: string
}

export interface CreatePlanRequest {
  description?: string
  sourcePlanId?: string // Copy weights from this plan if provided
  assets?: PlanAssetInput[] // Initial assets (e.g., from holdings)
}

export interface UpdatePlanRequest {
  description?: string
  assets?: PlanAssetInput[]
}

export interface PriceInput {
  assetId: string
  price: number
  currency: string
}

export interface UpdatePricesRequest {
  prices: PriceInput[]
}

// API Response Wrappers (new structure)
export interface ModelResponse {
  data: ModelDto
}

export interface ModelsResponse {
  data: ModelDto[]
}

export interface PlansResponse {
  data: PlanDto[]
}

// UI-specific Types
export interface AssetWeightWithDetails {
  assetId: string
  weight: number
  sortOrder?: number
  assetCode?: string
  assetName?: string
  currentValue?: number
  currentWeight?: number
  rationale?: string
  capturedPrice?: number
  priceCurrency?: string
}

export interface CreateModelFromHoldingsData {
  portfolioId: string
  portfolioCode: string
}

export type RebalanceAction = "BUY" | "SELL" | "HOLD"

// === Execution Types (persisted rebalance configurations) ===

export type ExecutionPlanStatus =
  "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"

export type ExecutionMode = "REBALANCE" | "INVEST_CASH" | "AD_HOC"

export interface ExecutionDto {
  id: string
  /** Null for AD_HOC mode (no model/plan behind the execution) */
  planId: string | null
  planVersion: number | null
  modelId: string | null
  modelName: string | null
  portfolioIds: string[]
  name?: string
  snapshotTotalValue: number
  snapshotCashValue: number
  totalPortfolioValue: number
  currency: string
  status: ExecutionPlanStatus
  mode: ExecutionMode
  /** Investment amount for INVEST_CASH mode */
  investmentAmount?: number
  /** When true, only considers positions from transactions tagged with this model's ID */
  filterByModel?: boolean
  items: ExecutionItemDto[]
  cashSummary: CashSummaryDto
  createdAt: string
  updatedAt: string
}

export interface ExecutionSummaryDto {
  id: string
  /** Null for AD_HOC mode (no model/plan behind the execution) */
  planId: string | null
  planVersion: number | null
  modelId: string | null
  modelName: string | null
  name?: string
  portfolioCount: number
  status: ExecutionPlanStatus
  mode: ExecutionMode
  snapshotTotalValue: number
  currency: string
  createdAt: string
  updatedAt: string
}

export interface ExecutionItemDto {
  id: string
  assetId: string
  assetCode?: string
  assetName?: string
  snapshotWeight: number
  snapshotValue: number
  snapshotQuantity: number
  snapshotPrice?: number
  /** Trade-currency (native) price used for booking on commit; null on pre-existing rows */
  nativePrice?: number | null
  priceCurrency?: string
  planTargetWeight: number
  /** Return-adjusted target accounting for price movements since model creation */
  returnAdjustedTarget?: number
  effectiveTarget: number
  hasOverride: boolean
  deltaValue: number
  deltaQuantity: number
  action: RebalanceAction
  excluded: boolean
  locked: boolean
  transactionId?: string
  sortOrder: number
  /** Whether this item represents cash position */
  isCash?: boolean
  /** Rationale for why this asset is in the model */
  rationale?: string
  /**
   * Non-tradeable asset (e.g. CPF) the server always excludes from
   * execution — un-exclude requests are silently ignored server-side.
   * Optional so the UI degrades gracefully against a backend that hasn't
   * deployed the field yet; see the initial-excluded-at-load fallback in
   * `useRebalanceExecution`. Absent/undefined does NOT mean "not private" —
   * it means "unknown, use the fallback."
   */
  isPrivate?: boolean
}

export interface CashSummaryDto {
  currentCash: number
  cashFromSales: number
  cashForPurchases: number
  netImpact: number
  projectedCash: number
  projectedMarketValue: number
}

export interface CreateExecutionRequest {
  /** Required for REBALANCE/INVEST_CASH; omitted (and rejected if supplied) for AD_HOC */
  planId?: string
  portfolioIds: string[]
  name?: string
  /** Execution mode: REBALANCE (default), INVEST_CASH, or AD_HOC */
  mode?: ExecutionMode
  /** Amount of cash to invest (only used in INVEST_CASH mode) */
  investmentAmount?: number
  /** Cash to deploy/remove (only used in REBALANCE mode; defaults to 0) */
  cashDelta?: number
  /** When true, only consider positions from transactions tagged with this model's ID */
  filterByModel?: boolean
  /** Required for AD_HOC mode — the portfolio's report currency */
  currency?: string
}

export interface CommitExecutionRequest {
  /** Portfolio ID to create transactions for */
  portfolioId: string
  /** Transaction status: PROPOSED (default) or SETTLED */
  transactionStatus?: "PROPOSED" | "SETTLED"
  /** Optional cash asset ID for settlement (e.g., a brokerage account asset) */
  cashAssetId?: string
}

export interface CommitExecutionResponse {
  data: {
    transactionsCreated: number
    transactionIds: string[]
    portfolioId: string
  }
}

export interface UpdateExecutionRequest {
  name?: string
  itemUpdates?: ExecutionItemUpdate[]
}

export interface ExecutionItemUpdate {
  assetId: string
  effectiveTargetOverride?: number
  excluded?: boolean
}

export interface ExecutionApiResponse {
  data: ExecutionDto
}

export interface ExecutionsApiResponse {
  data: ExecutionSummaryDto[]
}

// Models containing asset lookup types
export interface ModelWithPlanDto {
  modelId: string
  modelName: string
  planId: string
  planVersion: number
  targetWeight: number
  assetCode?: string
  assetName?: string
}

export interface ModelsContainingAssetResponse {
  data: ModelWithPlanDto[]
}
