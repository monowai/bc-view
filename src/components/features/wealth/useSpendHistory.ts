import { useState } from "react"
import useSwr from "swr"
import type { SpendDebit, SpendEntry, SpendResponse } from "types/independence"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { spendKey } from "@utils/api/client/independence"
import { trailingMonths } from "@lib/independence/spendSummary"

/** Months of spend history loaded; the dashboard summary uses the last 12. */
const HISTORY_MONTHS = 24

/**
 * The user's spend log over the last two years. Every reader asks for the
 * same window, so they share one SWR entry and one refresh.
 */
export function useSpendHistory(): {
  /** `YYYY-MM`, oldest first. */
  historyMonths: string[]
  entries: SpendEntry[]
  /** The bank withdrawals posted for months in the window. */
  debits: SpendDebit[]
  isLoading: boolean
  error: unknown
  refresh: () => void
} {
  // Fixed at mount: the window must not shift between renders.
  const [historyMonths] = useState(() =>
    trailingMonths(new Date(), HISTORY_MONTHS),
  )
  const url = spendKey(
    historyMonths[0],
    historyMonths[historyMonths.length - 1],
  )
  const { data, error, isLoading, mutate } = useSwr<SpendResponse>(
    url,
    simpleFetcher(url),
  )
  return {
    historyMonths,
    entries: data?.data ?? [],
    debits: data?.debits ?? [],
    isLoading: Boolean(isLoading),
    error,
    refresh: () => void mutate(),
  }
}
