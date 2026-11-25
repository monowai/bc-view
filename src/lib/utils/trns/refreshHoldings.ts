import { holdingKey } from "@utils/api/fetchHelper"
import { aggregatedHoldingsTodayKey } from "@utils/api/client/holdings"
import { refreshNetWorth } from "@lib/wealth/refreshNetWorth"

/** How long a posted transaction takes to reach the position service. */
const SETTLE_DELAY_MS = 1500

/**
 * After a transaction is written, refetch the holdings it changes: each
 * portfolio's, the aggregate, and net worth. Waits for the write to land.
 */
export const refreshHoldingsSoon = (
  mutate: (key: string) => unknown,
  ...portfolioCodes: string[]
): void => {
  setTimeout(() => {
    portfolioCodes.forEach((code) => mutate(holdingKey(code, "today")))
    mutate(aggregatedHoldingsTodayKey)
    refreshNetWorth()
  }, SETTLE_DELAY_MS)
}
