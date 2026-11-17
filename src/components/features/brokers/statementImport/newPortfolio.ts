import type { Broker } from "types/beancounter"
import { brokerLabel } from "./BrokerageAccountPicker"

/** The Portfolio choice that creates one when the holdings are recorded. */
export const CREATE_PORTFOLIO = "__NEW__"

/** The currency a new portfolio starts in when the firm names none. */
export const FALLBACK_CURRENCY = "USD"

/** A portfolio to create on Record, named for the brokerage account. */
export interface NewPortfolio {
  code: string
  name: string
  currency: string
}

/**
 * A new portfolio for `broker`: its code is the account's name in capitals
 * (IBKR Main is IBKR-MAIN), with a number added when that code is in use.
 */
export function newPortfolioFor(
  broker: Pick<Broker, "name" | "accountNumber">,
  codesInUse: string[],
  currency: string,
): NewPortfolio {
  const base =
    broker.name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "IMPORT"
  const taken = new Set(codesInUse.map((code) => code.toUpperCase()))
  let code = base
  for (let n = 2; taken.has(code); n++) code = `${base}-${n}`
  return { code, name: brokerLabel(broker), currency }
}
