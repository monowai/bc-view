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
  investmentAllocationPercent: number
  createdDate: string
  updatedDate: string
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
  investmentAllocationPercent?: number
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
  /** Target currency for calculations */
  currency?: string
  /** Portfolio IDs to fetch values from (optional - auto-resolves totalAssets) */
  portfolioIds?: string[]
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
  /** Non-spendable assets at retirement (e.g., property) */
  nonSpendableAtRetirement: number
  /** Housing return rate used for non-spendable asset growth during retirement */
  housingReturnRate: number
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

// ============ Wizard Form State ============
export interface ExpenseFormEntry {
  categoryLabelId: string
  categoryName: string
  monthlyAmount: number
}

export interface WizardFormData {
  // Step 1: Personal Info
  planName: string
  yearOfBirth: number
  targetRetirementAge: number
  lifeExpectancy: number

  // Step 2: Pre-Retirement (working years)
  workingIncomeMonthly: number
  workingExpensesMonthly: number
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
  investmentAllocationPercent: number
  expenses: ExportedExpense[]
}

export interface PlanExportResponse {
  data: PlanExport
}
