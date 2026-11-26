import { isHoldingsKey } from "@utils/api/client/holdings"
import { refreshNetWorth } from "@lib/wealth/refreshNetWorth"

/** How long a posted transaction takes to reach the position service. */
const SETTLE_DELAY_MS = 1500

/**
 * After a transaction is written, refetch the holdings it changes and net
 * worth. Every holdings view is matched, whether cached by portfolio code, by
 * portfolio id (shared portfolios) or as the aggregate. Waits for the write to
 * land.
 */
export const refreshHoldingsSoon = (
  mutate: (matcher: (key: unknown) => boolean) => unknown,
): void => {
  setTimeout(() => {
    mutate(isHoldingsKey)
    refreshNetWorth()
  }, SETTLE_DELAY_MS)
}
