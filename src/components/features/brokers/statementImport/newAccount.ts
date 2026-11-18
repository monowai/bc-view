import type { Broker, ConfirmedCash } from "types/beancounter"
import { brokerLabel } from "./BrokerageAccountPicker"

/** The Brokerage account choice that creates one when the holdings are recorded. */
export const CREATE_ACCOUNT = "__NEW_ACCOUNT__"

/** A brokerage account to create on Record. */
export interface NewAccount {
  name: string
  /** "" when the user gave none. */
  accountNumber: string
  /** The firm it is an account with; absent for another brokerage. */
  globalBrokerId?: string
  /** The cash it holds, recorded with the holdings; absent when none was given. */
  cash?: ConfirmedCash
}

type ImportBroker = Pick<Broker, "id" | "name" | "accountNumber">

/** Where the holdings are recorded: an account, or one to create on Record. */
export type ImportAccount =
  { broker: ImportBroker } | { createAccount: NewAccount }

/** How an account, or one to create, is named. */
export function accountLabel(account: ImportAccount): string {
  if ("broker" in account) return brokerLabel(account.broker)
  return `Create ${brokerLabel(namedAs(account.createAccount))}`
}

/** The name and number a portfolio for this account is called after. */
export function namedAs(
  account: NewAccount,
): Pick<Broker, "name" | "accountNumber"> {
  return {
    name: account.name,
    accountNumber: account.accountNumber || undefined,
  }
}
