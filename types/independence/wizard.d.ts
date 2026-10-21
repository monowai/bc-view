import type { ContributionType } from "./cashflow"
import type {
  AssetDisposal,
  HeadlineMetric,
  LifeEvent,
  ManualAssets,
  PrimaryStrategy,
  WithdrawalOrder,
} from "./plan"

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
  /** Optional free-text country whose values this plan targets (e.g. "Thailand"). */
  country?: string
  /** Optional user-authored narrative describing the plan context / assumptions. */
  narrative?: string
  /**
   * Optional primary strategy override. Empty string means "auto-detect"
   * (passed to backend as null).
   */
  primaryStrategy?: PrimaryStrategy | ""
  /**
   * Optional headline-metric override. Empty string means "default for
   * effective strategy".
   */
  headlineMetric?: HeadlineMetric | ""
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
  benefitsStartAge?: number
  otherIncomeMonthly: number

  // Step 4: Expenses
  expenses: ExpenseFormEntry[]
  expensesCurrency: string

  // Step 5: Goals & Assumptions
  targetBalance?: number
  /**
   * True — the default for a new stage — means the journey's assumptions run
   * and the stage's own rate columns are ignored by the engine.
   *
   * False means the stage runs on its own six rate columns. This form edits
   * only the four return/inflation ones below; `feeRate` and
   * `investmentTaxRate` stay whatever the stage row already holds, because
   * the wizard has never surfaced them — `toPlanRequestPayload` echoes both
   * so a wizard save cannot reset them.
   */
  assumptionsInherited: boolean
  cashReturnRate: number
  equityReturnRate: number
  housingReturnRate: number
  inflationRate: number
  // Asset allocation (percentages, should sum to 100)
  cashAllocation: number
  equityAllocation: number
  housingAllocation: number
  /**
   * Wrapper-pool drawdown order (svc-retire #153 scope item 1). Only shown
   * when the wizard detects a US 401(k)/IRA or UK ISA wrapper asset;
   * otherwise left at the default and never surfaced to the user.
   */
  withdrawalOrder?: WithdrawalOrder

  // Portfolio Integration
  selectedPortfolioIds: string[]
  excludedPortfolioIds?: string[]
  excludedRentalAssetIds?: string[]

  // Manual Asset Entry (for users without portfolios)
  manualAssets: ManualAssets

  // Life Events (one-off income/expense at specific ages)
  lifeEvents: LifeEvent[]

  // Asset disposals (holding-bound sales / downsizes)
  assetDisposals: AssetDisposal[]

  // Pension/Insurance Contributions
  contributions: ContributionFormEntry[]
}
