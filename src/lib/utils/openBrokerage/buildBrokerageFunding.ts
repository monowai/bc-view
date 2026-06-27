import type { FundingAccount } from "./orchestrate"

/**
 * Build the `funding` rows for openBrokerage from the onboarding brokerage
 * step — one account per currency the user expects to trade. openBrokerage
 * opens the per-broker cash asset ({code}-{ccy}) for each and registers it as
 * the broker's default settlement account for that currency.
 *
 * Opening balances are recorded later (Tools → Open Brokerage, or a normal cash
 * deposit), so no DEPOSIT is posted here — every row is amount 0. Currencies are
 * trimmed and de-duplicated so a repeated pick can't open the same account twice.
 */
export function buildBrokerageFunding(currencies: string[]): FundingAccount[] {
  const seen = new Set<string>()
  const rows: FundingAccount[] = []
  for (const code of currencies) {
    const ccy = code.trim()
    if (!ccy || seen.has(ccy)) continue
    seen.add(ccy)
    rows.push({ currency: ccy, amount: 0 })
  }
  return rows
}
