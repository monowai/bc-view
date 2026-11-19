// ============ Monthly Spend Log ============

/** One category's projected and actual spend for one month (svc-retire monthly_spend; the user's, shared by all their plans). */
export interface SpendEntry {
  /** YYYY-MM */
  month: string
  categoryLabelId: string
  categoryName: string
  projected: number | null
  actual: number | null
  currency: string
  /** Filled by svc-retire for a past month the user left unrecorded: projected, else budget. */
  estimated: boolean
}

export interface SpendResponse {
  data: SpendEntry[]
}

export interface SpendRequest {
  currency: string
  entries: Array<
    Pick<
      SpendEntry,
      "categoryLabelId" | "categoryName" | "projected" | "actual"
    >
  >
}
