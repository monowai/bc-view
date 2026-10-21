import type { WithdrawalOrder } from "./plan"

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
  benefitsStartAge?: number
  otherIncomeMonthly: number
  workingIncomeMonthly: number
  workingExpensesMonthly: number
  taxesMonthly: number
  bonusMonthly: number
  investmentAllocationPercent: number
  expenses: ExportedExpense[]
  lifeEvents?: string
  assetDisposals?: string
  manualAssets?: Record<string, number>
  clientId?: string
  /** Optional country whose values this plan targets. */
  country?: string
  /** Optional user-authored narrative describing the plan. */
  narrative?: string
  /**
   * Optional wrapper-pool drawdown order (svc-retire #153 scope item 1).
   * Null imports as the engine default (DEFERRED_FIRST), so exports taken
   * before this field existed still import cleanly.
   */
  withdrawalOrder?: WithdrawalOrder
}

export interface PlanExportResponse {
  data: PlanExport
}
