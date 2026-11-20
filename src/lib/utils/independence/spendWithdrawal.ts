import type { CallerRef } from "types/beancounter"

/** svc-retire's caller-ref provider on a month's spend withdrawal (batch = `YYYY-MM`). */
export const SPEND_PROVIDER = "SPEND"

const MONTH = /^\d{4}-\d{2}$/

/**
 * The month a transaction withdraws spend for, or null when it is not a spend
 * withdrawal. Editing one opens the spend log for that month, since svc-retire
 * owns the transaction and rewrites it on every save.
 */
export function spendWithdrawalMonth(trn: {
  callerRef: CallerRef | null
}): string | null {
  const ref = trn.callerRef
  return ref?.provider === SPEND_PROVIDER && MONTH.test(ref.batch)
    ? ref.batch
    : null
}
