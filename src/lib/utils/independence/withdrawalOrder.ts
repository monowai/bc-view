import type { WithdrawalOrder } from "types/independence"
import type { PolicyType } from "types/beancounter"

/**
 * Wrapper-pool policy types that make the withdrawal-order choice
 * meaningful. Shared by every surface that decides whether to show the
 * selector (EditPlanDetailsModal, AssumptionsStep) so a new wrapper type
 * (e.g. a future SIPP) only needs updating here.
 */
export const WRAPPER_POLICY_TYPES: PolicyType[] = [
  "US_401K",
  "US_IRA",
  "UK_ISA",
]

/**
 * Engine default when a plan has never stored a withdrawal order
 * (svc-retire #153 scope item 1). Used only for what the selector
 * *displays* when nothing has been chosen yet — never as a fallback
 * baked into a saved/submitted value, so a plan that never touches the
 * selector still saves/sends nothing and the backend's own default holds.
 */
export const DEFAULT_WITHDRAWAL_ORDER: WithdrawalOrder = "DEFERRED_FIRST"

/**
 * Human labels for `WithdrawalOrder` (svc-retire #153 scope item 1) — the
 * order the tax-deferred (401(k)/IRA) and tax-free (Roth / UK ISA) drawdown
 * pools are liquidated in once the liquid pool runs short. Liquid is always
 * spent first regardless of this setting; it only decides between the two
 * wrapper pools. Required minimum distributions are still forced out in
 * every order. Keyed by the full `WithdrawalOrder` union so a new backend
 * value fails to compile here rather than silently rendering as a raw
 * string.
 */
const WITHDRAWAL_ORDER_LABELS: Record<WithdrawalOrder, string> = {
  DEFERRED_FIRST: "Tax-deferred first",
  TAX_FREE_FIRST: "Tax-free first",
  PRO_RATA: "Pro rata",
}

/**
 * Resolves a `WithdrawalOrder` value to its human label. Takes `string` at
 * this boundary (not `WithdrawalOrder`) because callers read this straight
 * off a backend response — an unrecognised value (a future backend addition
 * bc-view hasn't mirrored yet) falls back to the raw string rather than
 * hiding it.
 */
export function withdrawalOrderLabel(order: string): string {
  return WITHDRAWAL_ORDER_LABELS[order as WithdrawalOrder] ?? order
}

/**
 * Helper text explaining what each order means, for use beneath the
 * selector. Liquid (taxable) money is always spent first regardless of this
 * setting — it only decides between the two wrapper pools.
 */
export const WITHDRAWAL_ORDER_HELPER_TEXT: Record<WithdrawalOrder, string> = {
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
  value: WithdrawalOrder
  label: string
}> = [
  { value: "DEFERRED_FIRST", label: WITHDRAWAL_ORDER_LABELS.DEFERRED_FIRST },
  { value: "TAX_FREE_FIRST", label: WITHDRAWAL_ORDER_LABELS.TAX_FREE_FIRST },
  { value: "PRO_RATA", label: WITHDRAWAL_ORDER_LABELS.PRO_RATA },
]
