// Rebalance feature TypeScript types

// Enums
export type RebalanceScenario = "INVEST_CASH" | "REBALANCE"
export type ModelPlanStatus = "DRAFT" | "APPROVED"
export type ExecutionStatus =
  | "EXECUTED"
  | "SKIPPED"
  | "FAILED"
  | "ALREADY_LOCKED"
export type TransactionStatus = "UNSETTLED" | "SETTLED"
export type PlanStatus =
  | "DRAFT"
  | "CALCULATING"
  | "READY"
  | "EXECUTING"
  | "COMPLETED"
  | "CANCELLED"

// Model Types (new structure - Model is metadata only, weights are in Plans)
export interface ModelDto {
  id: string
  name: string
  objective?: string
  description?: string
  baseCurrency: string
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
}

export interface UpdateModelRequest {
  name: string
  objective?: string
  description?: string
  baseCurrency?: string
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

// Exclusion Types
export interface ExclusionInput {
  assetId: string
  allowSell?: boolean
}

export interface ExclusionDto {
  id: string
  assetId: string
  allowSell: boolean
}

// Plan Price Types
export interface SetPlanPriceRequest {
  assetId: string
  price: number
  currency: string
}

export interface PlanPriceDto {
  id: string
  assetId: string
  price: number
  currency: string
}

// Plan Item Types
export interface PlanItemDto {
  id: string
  assetId: string
  assetCode?: string
  assetName?: string
  portfolioId: string
  currentQuantity: number
  currentValue: number
  currentWeight: number
  targetWeight: number
  targetValue: number
  deltaValue: number
  deltaQuantity: number
  locked: boolean
  transactionId?: string
  excluded: boolean
  action: "BUY" | "SELL" | "HOLD"
}

// Rebalance Plan Types
export interface RebalancePlanDto {
  id: string
  name: string
  modelPortfolioId: string
  modelPortfolioName: string
  portfolioIds: string[]
  planCurrency: string
  scenario: RebalanceScenario
  cashDelta: number
  status: PlanStatus
  items: PlanItemDto[]
  prices: PlanPriceDto[]
  exclusions: ExclusionDto[]
  totalCurrentValue: number
  totalTargetValue: number
  unallocatedCash: number
  valuationTimestamp: string
  createdAt: string
  updatedAt: string
}

export interface RebalancePlanSummaryDto {
  id: string
  name: string
  modelPortfolioName: string
  portfolioCount: number
  planCurrency: string
  scenario: RebalanceScenario
  status: PlanStatus
  totalCurrentValue: number
  totalTargetValue: number
  createdAt: string
}

export interface CreateRebalancePlanRequest {
  name: string
  modelPortfolioId: string
  portfolioIds: string[]
  planCurrency: string
  scenario?: RebalanceScenario
  cashDelta?: number
  exclusions?: ExclusionInput[]
}

export interface UpdateRebalancePlanRequest {
  name?: string
  cashDelta?: number
  exclusions?: ExclusionInput[]
}

// Execution Types
export interface ExecutePlanRequest {
  itemIds?: string[]
  transactionStatus?: TransactionStatus
}

export interface ItemExecutionResultDto {
  itemId: string
  assetId: string
  portfolioId: string
  status: ExecutionStatus
  transactionId?: string
  message?: string
}

export interface ExecutionResultDto {
  planId: string
  executedCount: number
  skippedCount: number
  failedCount: number
  results: ItemExecutionResultDto[]
}

// API Response Wrappers (new structure)
export interface ModelResponse {
  data: ModelDto
}

export interface ModelsResponse {
  data: ModelDto[]
}

export interface PlanResponse {
  data: PlanDto
}

export interface PlansResponse {
  data: PlanDto[]
}

export interface ExecutionResponse {
  data: ExecutionResultDto
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
  positions: Record<string, { assetId: string; weight: number; name: string }>
}

// Rebalance Calculation Types (server-side calculation)
export type RebalanceAction = "BUY" | "SELL" | "HOLD"

export interface RebalanceCalculationRequest {
  portfolioIds: string[]
  cashDelta?: number
}

export interface RebalanceItemDto {
  assetId: string
  assetCode: string
  assetName: string
  currentWeight: number
  currentValue: number
  currentPrice?: number
  currentQuantity: number
  targetWeight: number
  targetPrice?: number
  priceCurrency: string
  deltaWeight: number
  deltaValue: number
  deltaQuantity: number
  action: RebalanceAction
}

export interface RebalanceCalculationDto {
  planId: string
  modelId: string
  modelName: string
  planVersion: number
  portfolioIds: string[]
  totalValue: number
  adjustedTotalValue: number
  cashDelta: number
  currency: string
  items: RebalanceItemDto[]
}

export interface RebalanceCalculationResponse {
  data: RebalanceCalculationDto
}

// === Execution Types (persisted rebalance configurations) ===

export type ExecutionPlanStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"

export interface ExecutionDto {
  id: string
  planId: string
  planVersion: number
  modelId: string
  modelName: string
  portfolioIds: string[]
  name?: string
  snapshotTotalValue: number
  snapshotCashValue: number
  totalPortfolioValue: number
  currency: string
  status: ExecutionPlanStatus
  items: ExecutionItemDto[]
  cashSummary: CashSummaryDto
  createdAt: string
  updatedAt: string
}

export interface ExecutionSummaryDto {
  id: string
  planId: string
  planVersion: number
  modelId: string
  modelName: string
  name?: string
  portfolioCount: number
  status: ExecutionPlanStatus
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
  priceCurrency?: string
  planTargetWeight: number
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
  planId: string
  portfolioIds: string[]
  name?: string
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

export interface ExecuteItemsRequest {
  itemIds?: string[]
  transactionStatus?: TransactionStatus
}

export interface ExecutionApiResponse {
  data: ExecutionDto
}

export interface ExecutionsApiResponse {
  data: ExecutionSummaryDto[]
}