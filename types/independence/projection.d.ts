import type { HeadlineMetric, PrimaryStrategy, WithdrawalOrder } from "./plan"

// ============ Projection Warnings ============
/**
 * Warning codes for data quality issues in projections.
 * When present, calculations may be unreliable.
 */
export type ProjectionWarning =
  | "RENTAL_INCOME_UNAVAILABLE"
  | "NO_EXPENSES"
  | "VALUATION_UNAVAILABLE"
  | "WORK_SCENARIO_MISSING"

// ============ Projections ============
export interface ProjectionRequest {
  /** Total assets (liquid + non-spendable). Auto-resolved if portfolioIds provided. */
  totalAssets?: number
  /** Liquid (spendable) assets only */
  liquidAssets?: number
  /** Non-spendable assets (e.g., property) - tracked separately for appreciation */
  nonSpendableAssets?: number
  /** Current age of the person */
  currentAge?: number
  /** Target retirement age (for pre-retirement accumulation calculations) */
  retirementAge?: number
  /** Life expectancy for planning horizon */
  lifeExpectancy?: number
  /** Monthly contribution during working years (for accumulation phase) */
  monthlyContribution?: number
  /** Monthly rental income from properties (in target currency) */
  rentalIncomeMonthly?: number
  /** Target currency for calculations (plan currency) */
  currency?: string
  /** Display currency for response values. If null, uses currency field. Backend converts all values. */
  displayCurrency?: string
  /** Portfolio IDs to fetch values from (optional - auto-resolves totalAssets) */
  portfolioIds?: string[]
  /** Optional work scenario ID — overrides current scenario for projection */
  workScenarioId?: string

  // ========== Plan Value Overrides (for What-If scenarios) ==========
  /** Override monthly expenses (default: use plan value) */
  monthlyExpenses?: number
  /** Override cash return rate (default: use plan value) */
  cashReturnRate?: number
  /** Override equity return rate (default: use plan value) */
  equityReturnRate?: number
  /** Override housing return rate (default: use plan value) */
  housingReturnRate?: number
  /** Override inflation rate (default: use plan value) */
  inflationRate?: number
  /** Override pension monthly (default: use plan value) */
  pensionMonthly?: number
  /** Override social security monthly (default: use plan value) */
  socialSecurityMonthly?: number
  /** Override other income monthly (default: use plan value) */
  otherIncomeMonthly?: number
  /** Override target balance (default: use plan value) */
  targetBalance?: number
  /** Override defined contribution amount. If non-null, used instead of auto-calculated. */
  definedContribution?: number
  /** Portfolio IDs to exclude from wealth and rental income. Overrides plan.excludedPortfolioIds. */
  excludedPortfolioIds?: string[]
  /**
   * When true, populate `RetirementProjection.debug` with a
   * `ProjectionDebug` block. Used by `/independence/debug` to verify
   * shared-plan projections actually used the plan owner's data.
   */
  includeDebug?: boolean
  /**
   * Override the wrapper-pool drawdown order for this run only, without
   * saving it (svc-retire #153 scope item 1). Null keeps the stored plan's
   * order. Same shape used for the Monte Carlo request body — svc-retire
   * accepts this field on both endpoints.
   */
  withdrawalOrder?: WithdrawalOrder
}

/**
 * Pre-retirement accumulation phase details.
 * Shows how assets grow before retirement through contributions and returns.
 */
export interface PreRetirementAccumulation {
  /** Years until retirement from current age */
  yearsToRetirement: number
  /** Current liquid assets before growth */
  currentLiquidAssets: number
  /** Future value of existing liquid assets at retirement */
  liquidAssetsAtRetirement: number
  /** Growth earned on existing liquid assets */
  growthOnExistingAssets: number
  /** Monthly contribution amount */
  monthlyContribution: number
  /** Total contributions over working years */
  totalContributions: number
  /** Future value of contributions (includes compound returns) */
  futureValueOfContributions: number
  /** Growth earned on contributions */
  growthOnContributions: number
  /** Current non-spendable assets (e.g., property) */
  currentNonSpendableAssets: number
  /** Future value of non-spendable assets at retirement */
  nonSpendableAtRetirement: number
  /** Blended annual return rate used for calculations */
  blendedReturnRate: number
  /** Housing return rate used for non-spendable growth */
  housingReturnRate: number
  /** Year-by-year accumulation projections during working years */
  yearlyProjections?: YearlyAccumulation[]
}

/**
 * Year-by-year accumulation during working years (pre-retirement).
 * Shows how contributions and growth build wealth before retirement.
 */
export interface YearlyAccumulation {
  /** Calendar year */
  year: number
  /** Age at this year */
  age: number
  /** Balance at start of year */
  startingBalance: number
  /** Contribution for this year (inflation-adjusted) */
  contribution: number
  /** Investment growth for this year */
  investmentGrowth: number
  /** Lump sum payout received this year (from maturing policies) */
  lumpSumPayout?: number
  /** Balance at end of year */
  endingBalance: number
  /** Non-spendable asset value (housing + CPF MA + CPF Annuity) for this year */
  nonSpendableValue: number
  /** Real-estate / housing portion of nonSpendableValue. */
  housingValue?: number
  /** CPF MA (and future composite non-liquid) portion of nonSpendableValue. */
  cpfNonLiquidValue?: number
  /** CPF LIFE annuity principal portion of nonSpendableValue. */
  annuitizedValue?: number
  /** Total wealth = endingBalance + nonSpendableValue */
  totalWealth: number
  /** Currency code */
  currency: string
  /** Portion of endingBalance held in tax-advantaged wrappers (401(k)/IRA/ISA
   * sub-accounts) whose withdrawal tax treatment differs from the rest of the
   * balance. Undefined/null when no wrapper configs exist for the plan. */
  shieldedValue?: number
}

/** Breakdown of income sources for a projection year */
export interface IncomeBreakdown {
  /** Investment returns (growth on portfolio balance) */
  investmentReturns: number
  /** Pension income from RetirementPlan (not inflation-indexed) */
  pension: number
  /** Pension income from pension assets (age-dependent payouts) */
  assetPensions?: number
  /** Lump sum payout from policies that mature this year */
  lumpSumPayout?: number
  /** Government benefits / Social Security (inflation-indexed) */
  socialSecurity: number
  /** Other income sources (not indexed) */
  otherIncome: number
  /** Property rental income (stops if liquidated) */
  rentalIncome: number
  /** Salary earned this year, while age is below the working-income age */
  workingIncome?: number
  /** One-off life event income at this age */
  lifeEventIncome?: number
  /** One-off life event expense at this age */
  lifeEventExpense?: number
  /** Total income from all sources */
  totalIncome: number
}

export interface YearlyProjection {
  year: number
  age?: number
  startingBalance: number
  investment: number
  withdrawals: number
  endingBalance: number
  inflationAdjustedExpenses: number
  currency: string
  /** Non-spendable asset value (housing + CPF MA + CPF Annuity) for this year */
  nonSpendableValue: number
  /** Real-estate / housing portion of nonSpendableValue. Liquidatable. */
  housingValue?: number
  /** CPF MA (and future composite non-liquid) portion of nonSpendableValue. Locked. */
  cpfNonLiquidValue?: number
  /** CPF LIFE annuity principal portion of nonSpendableValue. Locked. */
  annuitizedValue?: number
  /** Total wealth = endingBalance + nonSpendableValue */
  totalWealth: number
  /** True if property was liquidated this year (when liquid assets fell below 10%) */
  propertyLiquidated?: boolean
  /** Net life event amount (income - expense) for this year */
  lifeEventAmount?: number
  /**
   * Portion of `withdrawals` that couldn't be funded from this year's
   * available cash. Zero on sustainable years; positive when the plan
   * is insolvent.
   */
  unfundedExpense?: number
  /** Breakdown of income sources for this year */
  incomeBreakdown?: IncomeBreakdown
  /**
   * Traditional 401(k)/IRA balance at year end. Undefined/null when the
   * plan has no such wrapper pool (svc-retire #153 slice 3b — not itself
   * part of the withdrawal-order scope item, but the only signal bc-view
   * has for "this plan has a US/UK wrapper pool," so mirrored here too).
   */
  taxDeferredValue?: number
  /** Roth 401(k)/IRA + UK ISA balance at year end. See taxDeferredValue. */
  taxFreeValue?: number
  /**
   * Tax and early-withdrawal penalty paid on this year's deferred-pool
   * distribution. Null when the plan has no US pools.
   */
  withdrawalTaxPaid?: number | null
}

/**
 * Financial Independence (FIRE) metrics.
 * Based on the 4% safe withdrawal rate (25× multiplier).
 */
export interface FiMetrics {
  /** FI Number = 25× net annual expenses (after income sources) */
  fiNumber: number
  /** Progress toward FI as percentage (liquidAssets / fiNumber × 100) */
  fiProgress: number
  /** Gap to FI = fiNumber - liquidAssets (negative means FI achieved) */
  gapToFi: number
  /** Monthly expenses after subtracting income sources */
  netMonthlyExpenses: number
  /** Total monthly income (pension + social security + other + rental) */
  totalMonthlyIncome: number
  /** Savings rate as percentage of working income (null if not working) */
  savingsRate?: number
  /** Estimated years to reach FI using nominal returns (null if already FI or no savings) */
  yearsToFi?: number
  /** Estimated years to reach FI using real returns (inflation-adjusted, matches online calculators) */
  realYearsToFi?: number
  /** Coast FI number - amount needed now to reach FI by retirement with no further contributions */
  coastFiNumber?: number
  /** Progress toward Coast FI as percentage */
  coastFiProgress?: number
  /** Whether Coast FIRE has been achieved */
  isCoastFire: boolean
  /** Whether full Financial Independence has been achieved */
  isFinanciallyIndependent: boolean
  /** Warning: real return rate is below the 4% safe withdrawal rate */
  realReturnBelowSwr?: boolean
  /** The original plan currency before display conversion */
  planCurrency?: string
  /** FX rate applied for display conversion (1.0 if same as planCurrency) */
  displayFxRate?: number
  /**
   * Retirement-Age FI progress: credits PV of guaranteed pension income discounted
   * back to today. Lets pension savers see locked-in future income as progress
   * rather than ignoring it. Null when years-in-retirement is unknown.
   */
  retirementAgeFiProgress?: number
  /** Present value today of the guaranteed income stream used by retirementAgeFiProgress. */
  pvGuaranteedIncomeToday?: number
  /**
   * Years the liquid pot covers the self-funded window before guaranteed income
   * begins — the deferred-benefits bridge (retirementAge -> bridgeToAge), with a
   * pre-retirement runway fallback. Null when there is no gap.
   */
  bridgeYears?: number
  /** Years of bridge cover needed (bridgeToAge - drawdown start age). */
  bridgeYearsNeeded?: number
  /** bridgeYears / bridgeYearsNeeded x 100, capped at 100. */
  bridgeProgress?: number
  /**
   * Age at which the bridged guaranteed income (Social Security / CPF LIFE)
   * begins — the end of the self-funded bridge window. Used by the timeline to
   * shade the bridge and mark where SS/CPF income kicks in.
   */
  bridgeToAge?: number
  /** Income coverage at retirement age = totalMonthlyIncome / monthlyExpenses x 100. */
  incomeCoverageAtRetirement?: number
}

/**
 * Lightweight FI summary for display on plan cards.
 * Contains just the essential FI metrics without full projection details.
 */
export interface FiSummary {
  /** FI Number = 25× net annual expenses */
  fiNumber: number
  /** Progress toward FI as percentage (liquidAssets / fiNumber × 100) */
  fiProgress: number
  /** Current liquid (spendable) assets */
  liquidAssets: number
  /** Current non-spendable assets (e.g., property) */
  nonSpendableAssets: number
  /** Total assets (liquid + non-spendable) */
  totalAssets: number
  /** Currency for all values */
  currency: string
  /** Whether full Financial Independence has been achieved */
  isFinanciallyIndependent: boolean
  /** The original plan currency before display conversion */
  planCurrency?: string
  /** FX rate applied for display conversion (1.0 if same as planCurrency) */
  displayFxRate?: number
}

export interface FiSummaryResponse {
  data: FiSummary
}

/**
 * Plan input values used in projection calculations.
 * Returned in display currency so frontend doesn't need FX conversion.
 */
export interface PlanInputs {
  /** Monthly expenses used in calculations */
  monthlyExpenses: number
  /** Monthly pension income */
  pensionMonthly: number
  /** Monthly government benefits / social security */
  socialSecurityMonthly: number
  /** Monthly other income */
  otherIncomeMonthly: number
  /** Monthly rental income (fetched from svc-data) */
  rentalIncomeMonthly: number
  /** Monthly working income */
  workingIncomeMonthly: number
  /** Monthly contribution during working years */
  monthlyContribution: number
  /** Target balance at end of planning horizon */
  targetBalance?: number
  /** Inflation rate as decimal */
  inflationRate: number
  /** Blended return rate as decimal */
  blendedReturnRate: number
  /** Defined contribution deduction applied (e.g., CPF employee contribution) */
  definedContribution?: number
  /**
   * Plan owner's current age, resolved from settings.yearOfBirth via the
   * plan owner (NOT the caller). Lets the frontend populate shared-plan
   * sliders from the projection response rather than the caller-scoped
   * settings hook.
   */
  currentAge?: number
  /** Plan owner's yearOfBirth from settings. */
  yearOfBirth?: number
  /** Plan owner's life expectancy from settings. */
  lifeExpectancy?: number
  /** Plan owner's resolved retirement age. */
  retirementAge?: number
}

/**
 * Optional diagnostic block returned when `ProjectionRequest.includeDebug`
 * is true. Used by `/independence/debug` to spot-check the auth posture
 * driving cross-service fetches (catches viewer-data leaks into shared
 * plans).
 */
export interface ProjectionDebug {
  callerOwnerId: string
  planOwnerId: string
  planSystemUserId?: string
  ownerScopedFetch: boolean
  resolution: Record<string, string>
  resolvedInputs: ResolvedInputs
}

export interface ResolvedInputs {
  liquidAssets: number
  nonSpendableAssets: number
  rentalIncomeMonthly: number
  pensionConfigCount: number
  cpfLifeMonthlyTotal: number
  currency: string
  portfolioIds: string[]
}

export type FindingSeverity = "CRITICAL" | "WARNING" | "POSITIVE" | "INFO"

export interface Finding {
  /** Stable identifier the UI maps to an icon and optional call-to-action. */
  code: string
  severity: FindingSeverity
  title: string
  detail: string
}

/**
 * Inflation treatment for a single income stream within a projection.
 * `inflationIndexed: true` => the stream rises with inflation each year.
 * `false` => the stream is a FIXED nominal amount (e.g. most employer
 * pensions) and does NOT keep pace with inflation in future dollars.
 */
export interface IncomeStreamBasis {
  /** Stream identifier, e.g. "pension", "socialSecurity", "rentalIncome". */
  key: string
  /** True when the stream is inflation-indexed; false when fixed nominal. */
  inflationIndexed: boolean
}

/**
 * Describes the value basis of a projection so the UI can tell users
 * whether figures are in today's or future (nominal) dollars, and which
 * income streams keep pace with inflation. Backend-driven — the frontend
 * must NOT re-derive indexation from its own assumptions.
 */
export interface ValueBasis {
  /** e.g. "NOMINAL_FUTURE" — all balances/expenses are inflated future dollars. */
  balanceBasis: string
  /** Per-stream inflation treatment. */
  incomeStreams: IncomeStreamBasis[]
}

/**
 * Off-track diagnostic block returned by svc-retire ONLY when the plan's money
 * runs out before life expectancy. Describes what it would take — extra monthly
 * contribution OR a higher return rate — to carry the plan all the way to
 * `targetAge`. Null/absent when the plan is on-track.
 *
 * All amounts are in the plan currency (`projection.currency`). A null lever
 * means the solver could not find a value within its bounds (unsolvable).
 * Return rates are DECIMALS (e.g. 0.0432 = 4.32%).
 */
export interface PathToHorizon {
  /** Age the plan must last to — equals life expectancy (e.g. 90). */
  targetAge: number
  /** Current monthly contribution, plan currency. */
  currentMonthlyContribution: number
  /** Monthly contribution needed to reach targetAge; null = unsolvable. */
  requiredMonthlyContribution: number | null
  /** Current blended return rate as a decimal (e.g. 0.015 = 1.5%). */
  currentReturnRate: number
  /** Return rate needed to reach targetAge as a decimal; null = unsolvable. */
  requiredReturnRate: number | null
}

export interface RetirementProjection {
  planId: string
  asOfDate: string
  totalAssets: number
  liquidAssets: number
  monthlyExpenses: number
  runwayMonths: number
  runwayYears: number
  depletionAge?: number
  targetBalance?: number
  surplusOrDeficit?: number
  currency: string
  yearlyProjections: YearlyProjection[]
  /** The earliest age at which retirement is sustainable until life expectancy */
  earliestRetirementAge?: number
  /** Years until earliest possible retirement from current age */
  yearsUntilRetirement?: number
  /** Pre-retirement accumulation phase details (null if already retired or no accumulation) */
  preRetirementAccumulation?: PreRetirementAccumulation
  /** Year-by-year accumulation projections during working years (for chart) */
  accumulationProjections?: YearlyAccumulation[]
  /** Non-spendable assets at retirement (e.g., property) */
  nonSpendableAtRetirement: number
  /** Housing return rate used for non-spendable asset growth during retirement */
  housingReturnRate: number
  /** Liquid balance at the point when illiquid assets were sold */
  liquidBalanceAtLiquidation?: number
  /** Threshold % at which illiquid assets are sold */
  liquidationThresholdPercent?: number
  /** Financial Independence (FIRE) metrics */
  fiMetrics?: FiMetrics
  /** Age at which FI is achieved (liquid assets >= FI number) */
  fiAchievementAge?: number
  /** FIRE path projections - what happens if you retire at FI age instead of planned retirement */
  firePathProjections?: YearlyProjection[]
  /** The original plan currency before display conversion */
  planCurrency?: string
  /** FX rate applied for display conversion (1.0 if same as planCurrency) */
  displayFxRate?: number
  /** Plan input values used in calculations (in display currency) */
  planInputs?: PlanInputs
  /** Sustainable monthly expense from liquid assets only (no property sale) */
  sustainableMonthlyExpense?: number
  /** Adjustment from current expenses: positive = room to increase, negative = need to cut */
  expenseAdjustment?: number
  /** Adjustment as percentage of current expenses */
  expenseAdjustmentPercent?: number
  /** Target ending balance used for sustainable expense calculation */
  sustainableTargetBalance?: number
  /**
   * The same question asked from today rather than from retirement: the one
   * level monthly spend the plan sustains if the working years are charged
   * that spend too, not the plan's declared expenses (svc-retire#274).
   *
   * Absent when it adds nothing — already retired (no accumulation window),
   * or the two answers agree within the solver's tolerance. Show one figure
   * when you receive one; never compare them here.
   */
  sustainableFromToday?: number
  /** Difference: sustainableFromToday − current monthly expenses */
  adjustmentFromToday?: number
  /** Percentage adjustment for the from-today figure */
  adjustmentPercentFromToday?: number
  /** Sustainable monthly expense if illiquid assets are sold when liquid assets are low */
  sustainableWithLiquidation?: number
  /** Adjustment from current expenses for the with-liquidation figure */
  adjustmentWithLiquidation?: number
  /** Percentage adjustment for the with-liquidation figure */
  adjustmentPercentWithLiquidation?: number
  /**
   * Age at which the property is actually liquidated in the baseline
   * projection — the first `yearlyProjections` row with
   * `propertyLiquidated === true`. See sustainableLiquidationAge for the
   * with-liquidation what-if.
   */
  liquidationAge?: number
  /**
   * Age at which the property is liquidated in the with-liquidation
   * what-if scenario — i.e. spending `sustainableWithLiquidation` instead
   * of the plan's real configured expenses. Distinct from liquidationAge;
   * the two ages can differ (svc-retire#271).
   */
  sustainableLiquidationAge?: number
  /**
   * Statutory CPF LIFE lock age (55) when the OA/SA -> RA annuity fold falls
   * within the horizon; absent when already past the lock or no CPF. Read this
   * directly for the "🔒 CPF LIFE" marker — do NOT re-derive from the
   * annuitizedValue transition (that lands one row early, at age 54).
   */
  cpfLifeAge?: number
  /** Data quality warnings - empty means all data fetched successfully */
  warnings?: ProjectionWarning[]
  /** Plan-level insights derived from the projection (Plan Insights list). */
  findings?: Finding[]
  /**
   * Explicit primary strategy set on the plan, or undefined if auto-detected.
   * Used by the plan-edit dropdown to show which option is currently pinned.
   */
  primaryStrategy?: PrimaryStrategy
  /**
   * Effective strategy used for UI emphasis: explicit override if set,
   * otherwise the result of the backend auto-detect rules.
   */
  effectiveStrategy?: PrimaryStrategy
  /** Plan owner's explicit headline metric override (or undefined when defaulting). */
  headlineMetric?: HeadlineMetric
  /**
   * Effective headline metric to display in the projection header and Wealth
   * tab: explicit override if set, otherwise the default for effectiveStrategy.
   */
  effectiveHeadlineMetric?: HeadlineMetric
  /**
   * Populated when `ProjectionRequest.includeDebug = true`. Surfaces the
   * resolved auth posture + input values so callers can verify a shared
   * plan projection used the plan owner's data rather than the viewer's.
   */
  debug?: ProjectionDebug
  /**
   * Value basis of the projection: whether figures are nominal/future and
   * which income streams are inflation-indexed. Optional — older backend
   * responses omit it, in which case the UI falls back to known defaults.
   */
  valueBasis?: ValueBasis
  /**
   * Off-track path to life expectancy. Present ONLY when the plan's money runs
   * out before life expectancy; null/absent when on-track. Tells the user what
   * extra contribution OR return rate would carry the plan to `targetAge`.
   */
  pathToHorizon?: PathToHorizon | null
  /**
   * The wrapper-pool drawdown order this projection actually ran with — the
   * stage's stored order, the request's what-if override, or the engine
   * default when neither states one (svc-retire #153 scope item 1). Read
   * this to show which option is selected rather than re-deriving it from
   * the request that was sent. Optional for backward compatibility, like
   * `valueBasis` above — a response for an already-serialized/cached
   * projection during a rolling svc-retire deploy may omit it. Consumers
   * should fall back to `DEFAULT_WITHDRAWAL_ORDER` when absent.
   */
  withdrawalOrder?: WithdrawalOrder
}

export interface ProjectionResponse {
  data: RetirementProjection
}

export interface ScenarioResult {
  name: string
  description: string
  projection: RetirementProjection
}

export interface ScenarioComparison {
  scenarios: ScenarioResult[]
}
