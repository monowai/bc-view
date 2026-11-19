// ============ Monthly Spend Log ============

/** One category's projected and actual spend for one month (svc-retire plan_spend). */
export interface PlanSpendEntry {
  /** YYYY-MM */
  month: string
  categoryLabelId: string
  categoryName: string
  projected: number | null
  actual: number | null
  currency: string
}

export interface PlanSpendResponse {
  data: PlanSpendEntry[]
}

export interface PlanSpendRequest {
  currency: string
  entries: Array<
    Pick<
      PlanSpendEntry,
      "categoryLabelId" | "categoryName" | "projected" | "actual"
    >
  >
}
