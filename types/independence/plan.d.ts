// ============ Manual Asset Categories ============
// Asset categories for users without portfolios
export type ManualAssetCategory =
  "CASH" | "EQUITY" | "ETF" | "MUTUAL_FUND" | "RE"

export type ManualAssets = Record<ManualAssetCategory, number>

/**
 * Primary retirement strategy the plan owner is pursuing. When omitted, the
 * backend auto-detects the effective strategy from plan metrics (income
 * sources, years-to-retirement).
 */
export type PrimaryStrategy = "FIRE" | "PENSION" | "HYBRID"

/**
 * Which metric the plan owner wants featured in the projection header and on
 * the Wealth management tab.
 */
export type HeadlineMetric =
  | "EARLY_RETIREMENT_PROGRESS"
  | "RETIREMENT_AGE_FI"
  | "INCOME_COVERAGE"
  | "BRIDGE_PROGRESS"

/**
 * Order the tax-deferred (401(k)/IRA) and tax-free (Roth / UK ISA) drawdown
 * pools are liquidated in once the liquid pool runs short (svc-retire #153
 * scope item 1). Liquid is always spent first regardless of this setting;
 * it only decides between the two wrapper pools. Required minimum
 * distributions are still forced out in every order. `DEFERRED_FIRST` =
 * spend deferred before tax-free. `TAX_FREE_FIRST` = spend tax-free before
 * deferred. `PRO_RATA` = split each year's shortfall in proportion to the
 * two pools' balances.
 */
export type WithdrawalOrder = "DEFERRED_FIRST" | "TAX_FREE_FIRST" | "PRO_RATA"

// ============ Plan Types ============
export interface RetirementPlan {
  id: string
  ownerId: string
  name: string
  planningHorizonYears: number
  lifeExpectancy: number
  yearOfBirth?: number
  monthlyExpenses: number
  expensesCurrency: string
  targetBalance?: number
  cashReturnRate: number
  equityReturnRate: number
  housingReturnRate: number
  inflationRate: number
  /** Always serialized by svc-retire; optional only to spare legacy fixtures. */
  feeRate?: number
  /** Always serialized by svc-retire; optional only to spare legacy fixtures. */
  investmentTaxRate?: number
  /**
   * Whether this stage runs on its journey's assumptions rather than its own
   * rate columns (svc-retire#284). Always serialized by svc-retire; optional
   * only to spare legacy fixtures. The backend forces it false for a stage
   * with no journey — there is nothing to inherit from.
   *
   * Asset allocation is deliberately NOT part of the inherited set: cash /
   * equity / housing stay per stage.
   */
  assumptionsInherited?: boolean
  cashAllocation: number
  equityAllocation: number
  housingAllocation: number
  pensionMonthly: number
  socialSecurityMonthly: number
  benefitsStartAge?: number
  otherIncomeMonthly: number
  workingIncomeMonthly: number
  workingExpensesMonthly: number
  taxesMonthly: number
  bonusMonthly: number
  investmentAllocationPercent: number
  lifeEvents?: string // JSON array of life events
  assetDisposals?: string // JSON array of asset disposals
  manualAssets?: Record<string, number> // JSON map of category -> value
  excludedPortfolioIds?: string[] | string // JSON array from backend
  excludedRentalAssetIds?: string[] | string // JSON array from backend
  clientId?: string // When set, plan managed by adviser on behalf of client
  /** Optional free-text country whose values this plan targets (e.g. "Thailand"). */
  country?: string
  /** Optional user-authored narrative describing the plan's context / assumptions. */
  narrative?: string
  /**
   * Explicit primary strategy override. When omitted the backend
   * auto-detects the effective strategy from plan metrics.
   */
  primaryStrategy?: PrimaryStrategy
  /**
   * Plan owner's preferred headline metric. When omitted the backend picks
   * a default that tracks the effective strategy.
   */
  headlineMetric?: HeadlineMetric
  isPrimary: boolean
  createdDate: string
  updatedDate: string
  /**
   * Id of the {@link IndependencePlan} (the "journey") this plan is a phase
   * of. Absent on legacy rows that pre-date the independence_plan table.
   */
  independencePlanId?: string
  /**
   * Plan owner's SystemUser.id, dual-populated on write. Null for legacy
   * rows pre-dating the system_user_id column; svc-retire lazy-backfills
   * during shared-plan projection. Used by bc-view to drive
   * owner-scoped portfolio filtering for shared plans.
   */
  systemUserId?: string
  /**
   * Wrapper-pool drawdown order for this stage (svc-retire #153 scope item
   * 1). Absent means the engine default (DEFERRED_FIRST). On PATCH, absent
   * or null leaves the stored choice alone.
   */
  withdrawalOrder?: WithdrawalOrder
}

export interface PlanCopyRequest {
  name: string
}

// Life event type for one-off income/expense at specific age.
//
// `assetType` indicates which pool the cashflow affects:
//   - "liquid"   (default): adds to / subtracts from spendable balance
//   - "illiquid": adds to / subtracts from non-spendable pool (e.g., property
//                 value at sale or replacement-property purchase)
// Field is optional for backward compatibility — older records and clients
// that omit it are treated as "liquid".
export interface LifeEvent {
  id: string
  age: number
  amount: number
  description: string
  eventType: "income" | "expense"
  assetType?: "liquid" | "illiquid"
}

// Asset disposal — holding-bound alternative to the 3-event downsize
// LifeEvent pattern. Binds to a specific tracked asset by `assetId` and
// describes the sale + cash-retention + replacement-property math.
//
// At `disposalAge` the backend:
//   - subtracts the asset's projected value from non-spendable
//   - routes `cashRetainedPct` to liquid
//   - routes (100 - cashRetainedPct - txCostsPct) back to non-spendable as
//     the replacement property
//   - suppresses the asset's rental income from disposalAge onward
//
// `enabled = false` is the per-plan "ignore this disposal" switch — same
// disposal record can fire in one plan and stay dormant in another for
// what-if scenarios.
export interface AssetDisposal {
  assetId: string
  disposalAge: number
  currentValue: number
  cashRetainedPct: number
  txCostsPct?: number
  description?: string
  enabled?: boolean
}

export interface PlanRequest {
  name: string
  planningHorizonYears?: number
  lifeExpectancy?: number
  yearOfBirth?: number
  monthlyExpenses: number
  expensesCurrency?: string
  targetBalance?: number | null
  cashReturnRate?: number
  equityReturnRate?: number
  housingReturnRate?: number
  inflationRate?: number
  cashAllocation?: number
  equityAllocation?: number
  housingAllocation?: number
  pensionMonthly?: number
  socialSecurityMonthly?: number
  benefitsStartAge?: number
  otherIncomeMonthly?: number
  workingIncomeMonthly?: number
  workingExpensesMonthly?: number
  taxesMonthly?: number
  bonusMonthly?: number
  investmentAllocationPercent?: number
  lifeEvents?: string
  assetDisposals?: string
  manualAssets?: Record<string, number> | null
  excludedPortfolioIds?: string[]
  excludedRentalAssetIds?: string[]
  clientId?: string
  /** Optional country whose values this plan targets (e.g. "Thailand"). */
  country?: string
  /** Optional user-authored narrative describing the plan. */
  narrative?: string
  /** Optional explicit primary strategy override. */
  primaryStrategy?: PrimaryStrategy
  /** Optional explicit headline metric override. */
  headlineMetric?: HeadlineMetric
  /**
   * Journey ("independence plan") this stage is created in. Create only —
   * svc-retire ignores it on PATCH. Omitted, the stage lands ungrouped and
   * appears in every journey's stage list.
   */
  independencePlanId?: string
  /**
   * Wrapper-pool drawdown order override (svc-retire #153 scope item 1).
   * PATCH semantics: null/absent on update leaves the stored choice alone.
   */
  withdrawalOrder?: WithdrawalOrder | null
}

export interface PlanResponse {
  data: RetirementPlan
}

export interface PlansResponse {
  data: RetirementPlan[]
  /**
   * Ids in `data` the caller does NOT own but has accepted a resource share
   * for. Used to populate the Shared tab on /independence.
   */
  sharedPlanIds?: string[]
}
