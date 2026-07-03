import { TRN_STATUS } from "types/constants"

/**
 * Build the `/api/trns` transaction-data row that links a composite-policy
 * (CPF today) or plain pension asset to a portfolio.
 *
 * Composite assets hold their balance in `subAccounts`, not in a top-level
 * `balance`. They post a BALANCE trn carrying the per-sub-account map and a
 * total equal to the sum of sub-account balances, so svc-position's
 * BalanceBehaviour persists the breakdown and svc-data's `whereHeld` resolves
 * a portfolio (no "isn't in a portfolio yet" banner). BALANCE does not impact
 * the portfolio's cash.
 *
 * Plain assets keep an ADD trn for the top-level balance (also cash-neutral).
 *
 * Returns null when there is nothing to link (no sub-accounts and no positive
 * top-level balance) so the caller can skip the POST.
 *
 * Single source of truth for onboarding (buildPensionTrn), the Add-Asset
 * create flow, and the LinkComposite dialog — keep the trn shape here.
 */
export interface CompositeBalanceTrnRow {
  assetId: string
  trnType: "BALANCE" | "ADD"
  quantity: number
  tradeCurrency: string
  tradeDate: string
  status: "SETTLED"
  price?: number
  tradeAmount?: number
  cashCurrency?: string
  comments?: string
  subAccounts?: Record<string, number>
}

export interface CompositeBalanceInput {
  assetId: string
  assetName: string
  currency: string
  tradeDate: string
  /** Per-sub-account balances; non-empty means "composite" → BALANCE trn. */
  subAccounts?: Array<{ code: string; balance: number }>
  /** Top-level balance for plain (non-composite) assets → ADD trn. */
  balance?: number
}

export function buildCompositeBalanceTrn(
  input: CompositeBalanceInput,
): CompositeBalanceTrnRow | null {
  const subAccounts = input.subAccounts ?? []

  if (subAccounts.length > 0) {
    const total = subAccounts.reduce((sum, sa) => sum + sa.balance, 0)
    const subAccountsMap = Object.fromEntries(
      subAccounts.map((sa) => [sa.code, sa.balance]),
    )
    return {
      assetId: input.assetId,
      trnType: "BALANCE",
      quantity: total,
      tradeAmount: total,
      tradeDate: input.tradeDate,
      tradeCurrency: input.currency,
      cashCurrency: input.currency,
      status: TRN_STATUS.SETTLED,
      comments: `Link ${input.assetName} balance to portfolio`,
      subAccounts: subAccountsMap,
    }
  }

  if (input.balance && input.balance > 0) {
    return {
      assetId: input.assetId,
      trnType: "ADD",
      quantity: input.balance,
      price: 1,
      tradeCurrency: input.currency,
      tradeDate: input.tradeDate,
      status: TRN_STATUS.SETTLED,
    }
  }

  return null
}
