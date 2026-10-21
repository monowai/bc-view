import type { PlanContribution, PlanExpense } from "./cashflow"

// ============ Work Scenario Types ============
export interface WorkScenario {
  id: string
  ownerId: string
  name: string
  isCurrent: boolean
  workingIncomeMonthly: number
  workingExpensesMonthly: number
  taxesMonthly: number
  bonusMonthly: number
  investmentAllocationPercent: number
  currency: string
  createdDate: string
  updatedDate: string
  computedMonthlyContribution: number
  /**
   * Logical-delete stamp (svc-retire #229). Absent/null on live scenarios.
   * Deleted scenarios are excluded from /scenarios and appear only under
   * /scenarios/deleted, where they can be restored with their expenses and
   * contributions intact.
   */
  deletedDate?: string | null
}

export interface WorkScenarioRequest {
  name: string
  workingIncomeMonthly?: number
  workingExpensesMonthly?: number
  taxesMonthly?: number
  bonusMonthly?: number
  investmentAllocationPercent?: number
  currency?: string
}

export interface WorkScenarioDetail {
  scenario: WorkScenario
  expenses: PlanExpense[]
  contributions: PlanContribution[]
  totalMonthlyExpenses: number
  totalMonthlyContributions: number
  computedMonthlyContribution: number
}

export interface WorkScenarioResponse {
  data: WorkScenarioDetail
}

export interface WorkScenariosResponse {
  data: WorkScenario[]
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
