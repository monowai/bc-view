import type { RetirementPlan } from "./plan"

// ============ Plan Expenses ============
export interface PlanExpense {
  id: string
  planId: string
  categoryLabelId: string
  categoryName: string
  monthlyAmount: number
  currency: string
  sortOrder: number
  /** Which part of life the expense belongs to; svc-retire defaults to RETIREMENT. */
  expensePhase?: "WORKING" | "RETIREMENT"
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
  /**
   * Age from which the owner occupies this property (owner-occupy from this
   * retirement phase onward). Rental income is suppressed in projections
   * from this age. Undefined/null means the property is rented throughout.
   */
  occupiedFromAge?: number
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
  /**
   * Age from which the owner occupies this property (owner-occupy from this
   * retirement phase onward). Rental income is suppressed in projections
   * from this age. Omitting this field clears it to null (rented throughout).
   */
  occupiedFromAge?: number
}

export interface PropertyIncomeResponse {
  data: PlanPropertyIncome
}

export interface PropertyIncomesResponse {
  data: PlanPropertyIncome[]
}
