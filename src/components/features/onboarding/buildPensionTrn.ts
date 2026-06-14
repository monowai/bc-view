import type { Pension } from "./OnboardingWizard"

/**
 * Build the `/api/trns` transaction-data row that links a pension asset
 * to the default portfolio during onboarding.
 *
 * Composite pensions (CPF today) hold their balance in `subAccounts`,
 * not in the top-level `balance`. Mirror what LinkCompositeDialog posts:
 * a BALANCE trn carrying the per-sub-account map and a total equal to
 * the sum of sub-account balances, so svc-position's BalanceBehaviour
 * persists the breakdown and svc-data's `whereHeld` resolves a portfolio
 * (no "isn't in a portfolio yet" banner for freshly-onboarded users).
 * BALANCE does not impact the portfolio's cash.
 *
 * Plain pensions keep the prior behaviour: an ADD trn for the top-level
 * balance (also cash-neutral).
 *
 * Returns null when there is nothing to link (no sub-accounts and no
 * positive top-level balance) so the caller can skip the POST.
 */
export interface PensionTrnRow {
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

export function buildPensionTrn(
  pension: Pension,
  assetId: string,
  tradeDate: string,
): PensionTrnRow | null {
  const subAccounts = pension.subAccounts ?? []

  if (subAccounts.length > 0) {
    const total = subAccounts.reduce((sum, sa) => sum + sa.balance, 0)
    const subAccountsMap = Object.fromEntries(
      subAccounts.map((sa) => [sa.code, sa.balance]),
    )
    return {
      assetId,
      trnType: "BALANCE",
      quantity: total,
      tradeAmount: total,
      tradeDate,
      tradeCurrency: pension.currency,
      cashCurrency: pension.currency,
      status: "SETTLED",
      comments: `Link ${pension.name} balance to portfolio`,
      subAccounts: subAccountsMap,
    }
  }

  if (pension.balance && pension.balance > 0) {
    return {
      assetId,
      trnType: "ADD",
      quantity: pension.balance,
      price: 1,
      tradeCurrency: pension.currency,
      tradeDate,
      status: "SETTLED",
    }
  }

  return null
}
