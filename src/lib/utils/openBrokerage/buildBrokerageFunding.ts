import type { FundingAccount } from "./orchestrate"

export interface BrokerageFundingInput {
  // Zen attaches the broker to the existing default portfolio; Master gives it
  // a dedicated one. Zen hides the deposit/source fields, so funding there is
  // always a zero-balance account opening.
  isZen: boolean
  // Currency the user picked for the brokerage (drives the {code}-{ccy} asset).
  currency: string
  // Parsed opening deposit. NaN or <= 0 means "open the account, post no trn".
  amount: number
  // Encoded source for the paired WITHDRAWAL: "", "portfolio:{id}" or
  // "bankAccount:{name}". Only honoured for a funded Master deposit.
  source: string
  // Portfolio the user's bank-account assets live on (the default portfolio).
  defaultPortfolioId: string
  // name → asset id for bank accounts added earlier in onboarding.
  bankAccountAssetIds: Record<string, string>
}

/**
 * Build the `funding` rows for openBrokerage from the onboarding wizard's
 * brokerage step. Always emits exactly one row for the chosen currency so the
 * per-broker cash asset (e.g. IB-USD) and its settlement mapping are created
 * even when no opening deposit is made. The DEPOSIT/WITHDRAWAL only posts when
 * `amount > 0` (orchestrate skips zero-amount rows), and a withdrawal source is
 * attached only for a funded Master deposit — Zen never moves cash.
 */
export function buildBrokerageFunding(
  input: BrokerageFundingInput,
): FundingAccount[] {
  const amount =
    Number.isFinite(input.amount) && input.amount > 0 ? input.amount : 0
  const fund: FundingAccount = { currency: input.currency, amount }
  if (!input.isZen && amount > 0) {
    if (input.source.startsWith("portfolio:")) {
      fund.sourcePortfolioId = input.source.slice("portfolio:".length)
    } else if (input.source.startsWith("bankAccount:")) {
      const name = input.source.slice("bankAccount:".length)
      const assetId = input.bankAccountAssetIds[name]
      if (assetId) {
        fund.sourceAssetId = assetId
        // Bank-account assets live on the default portfolio, not the new
        // brokerage portfolio being created — pin the WITHDRAWAL there.
        fund.sourcePortfolioId = input.defaultPortfolioId
      }
    }
  }
  return [fund]
}
