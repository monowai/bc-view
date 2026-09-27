/**
 * Human labels for `WithdrawalOrder` (svc-retire #153 scope item 1) — the
 * order the tax-deferred (401(k)/IRA) and tax-free (Roth / UK ISA) drawdown
 * pools are liquidated in once the liquid pool runs short. Liquid is always
 * spent first regardless of this setting; it only decides between the two
 * wrapper pools. Required minimum distributions are still forced out in
 * every order.
 */
const WITHDRAWAL_ORDER_LABELS: Record<string, string> = {
  DEFERRED_FIRST: "Tax-deferred first",
  TAX_FREE_FIRST: "Tax-free first",
  PRO_RATA: "Pro rata",
}

/**
 * Resolves a `WithdrawalOrder` value to its human label. An unrecognised
 * value (future backend addition bc-view hasn't mirrored yet) falls back to
 * the raw string rather than hiding it.
 */
export function withdrawalOrderLabel(order: string): string {
  return WITHDRAWAL_ORDER_LABELS[order] ?? order
}

/**
 * Helper text explaining what each order means, for use beneath the
 * selector. Liquid (taxable) money is always spent first regardless of this
 * setting — it only decides between the two wrapper pools.
 */
export const WITHDRAWAL_ORDER_HELPER_TEXT: Record<string, string> = {
  DEFERRED_FIRST:
    "Liquid savings are spent first. Once they run short, tax-deferred (401(k)/IRA) money is spent before tax-free (Roth/ISA).",
  TAX_FREE_FIRST:
    "Liquid savings are spent first. Once they run short, tax-free (Roth/ISA) money is spent before tax-deferred (401(k)/IRA).",
  PRO_RATA:
    "Liquid savings are spent first. Once they run short, each year's shortfall is split between the tax-deferred and tax-free pools in proportion to their balances.",
}

/**
 * Ordered (value, label) pairs for rendering the withdrawal-order `<select>`
 * — kept alongside the label map so the selector and the read-only echo
 * never drift from each other.
 */
export const WITHDRAWAL_ORDER_OPTIONS: Array<{
  value: "DEFERRED_FIRST" | "TAX_FREE_FIRST" | "PRO_RATA"
  label: string
}> = [
  { value: "DEFERRED_FIRST", label: WITHDRAWAL_ORDER_LABELS.DEFERRED_FIRST },
  { value: "TAX_FREE_FIRST", label: WITHDRAWAL_ORDER_LABELS.TAX_FREE_FIRST },
  { value: "PRO_RATA", label: WITHDRAWAL_ORDER_LABELS.PRO_RATA },
]
