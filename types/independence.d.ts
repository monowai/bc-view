// ============ Manual Asset Categories ============
// Asset categories for users without portfolios
export type ManualAssetCategory =
  | "CASH"
  | "EQUITY"
  | "ETF"
  | "MUTUAL_FUND"
  | "RE"

export type ManualAssets = Record<ManualAssetCategory, number>

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
  cashAllocation: number
  equityAllocation: number
  housingAllocation: number
  pensionMonthly: number
  socialSecurityMonthly: number
  otherIncomeMonthly: number
  workingIncomeMonthly: number
  workingExpensesMonthly: number
  taxesMonthly: number
  bonusMonthly: number
  investmentAllocationPercent: number
  lifeEvents?: string // JSON array of life events
  manualAssets?: Record<string, number> // JSON map of category -> value
  createdDate: string
  updatedDate: string
}

// Life event type for one-off income/expense at specific age
export interface LifeEvent {
  id: string
  age: number
  amount: number
  description: string
  eventType: "income" | "expense"
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
  otherIncomeMonthly?: number
  workingIncomeMonthly?: number
  workingExpensesMonthly?: number
  taxesMonthly?: number
  bonusMonthly?: number
  investmentAllocationPercent?: number
  lifeEvents?: string
  manualAssets?: Record<string, number> | null
}

export interface PlanResponse {
  data: RetirementPlan
}

export interface PlansResponse {
  data: RetirementPlan[]
}

// ============ Category Labels ============
export interface CategoryLabel {
  id: string
  ownerId: string
  name: string
  description?: string
  sortOrder: number
}

export interface CategoryLabelRequest {
  name: string
  description?: string
  sortOrder?: number
}

export interface CategoryLabelsResponse {
  data: CategoryLabel[]
}

// ============ Quick Scenarios ============
export interface QuickScenario {
  id: string
  ownerId: string
  name: string
  description?: string
  sortOrder: number
  retirementAgeOffset: number
  expensesPercent: number
  returnRateOffset: number
  inflationOffset: number
  contributionPercent: number
  createdDate: string
  updatedDate: string
}

export interface QuickScenarioRequest {
  name: string
  description?: string
  sortOrder?: number
  retirementAgeOffset?: number
  expensesPercent?: number
  returnRateOffset?: number
  inflationOffset?: number
  contributionPercent?: number
}

export interface QuickScenarioResponse {
  data: QuickScenario
}

export interface QuickScenariosResponse {
  data: QuickScenario[]
}

// ============ Plan Expenses ============
export interface PlanExpense {
  id: string
  planId: string
  categoryLabelId: string
  categoryName: string
  monthlyAmount: number
  currency: string
  sortOrder: number
}

export interface PlanExpenseRequest {
  categoryLabelId: string
  monthlyAmount: number
  currency?: string
  sortOrder?: number
}

export interface PlanExpensesResponse {
  data: PlanExpense[]
}

export interface PlanWithExpensesResponse {
  plan: RetirementPlan
  expenses: PlanExpense[]
  totalMonthlyExpenses: number
}

// ============ Projection Warnings ============
/**
 * Warning codes for data quality issues in projections.
 * When present, calculations may be unreliable.
 */
export type ProjectionWarning =
  | "ASSETS_FROM_FALLBACK"
  | "RENTAL_INCOME_UNAVAILABLE"
  | "NO_LIQUID_ASSETS"
  | "NO_MONTHLY_CONTRIBUTION"
  | "NO_EXPENSES"

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
  /** Non-spendable asset value for this year */
  nonSpendableValue: number
  /** Total wealth = endingBalance + nonSpendableValue */
  totalWealth: number
  /** Currency code */
  currency: string
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
  /** Non-spendable asset value (e.g., property) for this year */
  nonSpendableValue: number
  /** Total wealth = endingBalance + nonSpendableValue */
  totalWealth: number
  /** True if property was liquidated this year (when liquid assets fell below 10%) */
  propertyLiquidated?: boolean
  /** Breakdown of income sources for this year */
  incomeBreakdown?: IncomeBreakdown
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
  /** Sustainable monthly expense if illiquid assets are sold when liquid assets are low */
  sustainableWithLiquidation?: number
  /** Adjustment from current expenses for the with-liquidation figure */
  adjustmentWithLiquidation?: number
  /** Percentage adjustment for the with-liquidation figure */
  adjustmentPercentWithLiquidation?: number
  /** Age at which illiquid asset disposal begins in the with-liquidation scenario */
  liquidationAge?: number
  /** Data quality warnings - empty means all data fetched successfully */
  warnings?: ProjectionWarning[]
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

// ============ Plan Contributions ============
export type ContributionType = "PENSION" | "INSURANCE"

export interface PlanContribution {
  id: string
  planId: string
  assetId: string
  assetName?: string
  monthlyAmount: number
  currency: string
  contributionType: ContributionType
  createdDate: string
  updatedDate: string
}

export interface PlanContributionRequest {
  assetId: string
  assetName?: string
  monthlyAmount: number
  currency?: string
  contributionType: string
}

export interface PlanContributionsResponse {
  data: PlanContribution[]
  totalMonthlyContributions: number
}

// ============ Wizard Form State ============
export interface ExpenseFormEntry {
  categoryLabelId: string
  categoryName: string
  monthlyAmount: number
}

export interface ContributionFormEntry {
  assetId: string
  assetName: string
  monthlyAmount: number
  contributionType: ContributionType
}

export interface WizardFormData {
  // Step 1: Personal Info
  planName: string
  yearOfBirth: number
  targetRetirementAge: number
  lifeExpectancy: number

  // Step 2: Working Expenses (categorized expenses during working years)
  workingExpenses: ExpenseFormEntry[]

  // Step 3: Pre-Retirement (working years)
  workingIncomeMonthly: number
  workingExpensesMonthly: number // Computed from workingExpenses sum
  taxesMonthly: number
  bonusMonthly: number
  investmentAllocationPercent: number // Stored as percentage (e.g., 80 for 80%)

  // Step 3: Income Sources (retirement income)
  pensionMonthly: number
  socialSecurityMonthly: number
  otherIncomeMonthly: number

  // Step 4: Expenses
  expenses: ExpenseFormEntry[]
  expensesCurrency: string

  // Step 5: Goals & Assumptions
  targetBalance?: number
  cashReturnRate: number
  equityReturnRate: number
  housingReturnRate: number
  inflationRate: number
  // Asset allocation (percentages, should sum to 100)
  cashAllocation: number
  equityAllocation: number
  housingAllocation: number

  // Portfolio Integration
  selectedPortfolioIds: string[]

  // Manual Asset Entry (for users without portfolios)
  manualAssets: ManualAssets

  // Life Events (one-off income/expense at specific ages)
  lifeEvents: LifeEvent[]

  // Pension/Insurance Contributions
  contributions: ContributionFormEntry[]
}

// ============ Import/Export ============

export interface ExportedExpense {
  categoryLabelId: string
  categoryName: string
  monthlyAmount: number
  currency: string
  sortOrder?: number
}

export interface PlanExport {
  version: number
  exportedAt?: string
  name: string
  planningHorizonYears: number
  lifeExpectancy: number
  yearOfBirth?: number
  expensesCurrency: string
  targetBalance?: number
  cashReturnRate: number
  equityReturnRate: number
  housingReturnRate: number
  inflationRate: number
  cashAllocation: number
  equityAllocation: number
  housingAllocation: number
  pensionMonthly: number
  socialSecurityMonthly: number
  otherIncomeMonthly: number
  workingIncomeMonthly: number
  workingExpensesMonthly: number
  taxesMonthly: number
  bonusMonthly: number
  investmentAllocationPercent: number
  expenses: ExportedExpense[]
  lifeEvents?: string
  manualAssets?: Record<string, number>
}

export interface PlanExportResponse {
  data: PlanExport
}

// ============ Property Income ============

/**
 * Property income configuration for retirement planning.
 * Links a property asset to rental income settings within a plan.
 */
export interface PlanPropertyIncome {
  id: string
  planId: string
  assetId: string
  assetName?: string
  monthlyRentalIncome: number
  rentalCurrency: string
  isPrimaryResidence: boolean
  liquidationPriority: number
  createdDate: string
  updatedDate: string
}

export interface PropertyIncomeRequest {
  assetId: string
  assetName?: string
  monthlyRentalIncome?: number
  rentalCurrency?: string
  isPrimaryResidence?: boolean
  liquidationPriority?: number
}

export interface PropertyIncomeResponse {
  data: PlanPropertyIncome
}

export interface PropertyIncomesResponse {
  data: PlanPropertyIncome[]
}

// ============ Monte Carlo Simulation ============

export interface MonteCarloResponse {
  data: MonteCarloResult
}

export interface MonteCarloResult {
  planId: string
  iterations: number
  /** Success rate as percentage 0-100 */
  successRate: number
  terminalBalancePercentiles: PercentileValues
  yearlyBands: YearlyPercentileBand[]
  depletionAgeDistribution: DepletionAgeDistribution
  deterministicRunwayYears: number
  deterministicDepletionAge?: number
  currency: string
  parameters: MonteCarloParameters
}

export interface PercentileValues {
  p5: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  p95: number
}

export interface YearlyPercentileBand {
  year: number
  age?: number
  p5: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  p95: number
}

export interface DepletionAgeDistribution {
  depletedCount: number
  survivedCount: number
  earliestDepletionAge?: number
  mostCommonDepletionAge?: number
  percentiles?: PercentileValues
  histogram: Record<number, number>
  /** Per-iteration realized return summaries for depleted paths (capped at 50) */
  depletedPaths?: DepletedPathSummary[]
}

/** Summary of realized stochastic returns for a single depleted iteration */
export interface DepletedPathSummary {
  depletionAge: number
  /** Mean realized investment return p.a. up to depletion */
  averageReturn: number
  /** Worst single-year realized investment return */
  worstReturn: number
  /** Mean realized inflation p.a. up to depletion */
  averageInflation: number
  /** Highest single-year realized inflation */
  worstInflation: number
}

export interface MonteCarloParameters {
  blendedReturnRate: number
  blendedVolatility: number
  inflationRate: number
  inflationVolatility: number
  housingReturnRate: number
  housingVolatility: number
  equityVolatility: number
  cashVolatility: number
  equityCashCorrelation: number
  investmentTaxRate: number
}
