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

/** The bank withdrawal svc-retire posted for one month's actual spend. */
export interface SpendDebit {
  /** YYYY-MM */
  month: string
  portfolioId: string
  /** The private bank account debited. */
  cashAssetId: string
  trnId: string
  amount: number
  currency: string
}

export interface SpendResponse {
  data: SpendEntry[]
  debits?: SpendDebit[]
}

export interface SpendRequest {
  currency: string
  entries: Array<
    Pick<
      SpendEntry,
      "categoryLabelId" | "categoryName" | "projected" | "actual"
    >
  >
  /** The account to debit for the month's actual total; null debits nothing. */
  debit: Pick<SpendDebit, "portfolioId" | "cashAssetId"> | null
}
