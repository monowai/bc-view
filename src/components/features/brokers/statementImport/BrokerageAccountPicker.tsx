import React from "react"
import Alert from "@components/ui/Alert"
import type { Broker, GlobalBroker } from "types/beancounter"
import { CREATE_ACCOUNT } from "./newAccount"

/** The Brokerage choice for a firm Beancounter does not list. */
export const OTHER_FIRM = "__OTHER__"

const hintClass = "text-xs text-gray-500 mt-1.5"

/** The brokerage firm: it says which market the holdings trade on. */
export function BrokerageSelect({
  firms,
  firmId,
  disabled,
  className,
  onChoose,
}: {
  firms: GlobalBroker[]
  /** A firm id, OTHER_FIRM, or "" when none is chosen. */
  firmId: string
  disabled: boolean
  className: string
  onChoose: (firmId: string) => void
}): React.ReactElement {
  const market = firms.find((candidate) => candidate.id === firmId)?.config
    ?.market
  return (
    <div>
      <label htmlFor="import-brokerage" className="sr-only">
        Brokerage
      </label>
      <select
        id="import-brokerage"
        required
        value={firmId}
        disabled={disabled}
        onChange={(event) => onChoose(event.target.value)}
        className={className}
      >
        <option value="">Choose a brokerage…</option>
        {firms.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
        <option value={OTHER_FIRM}>Another brokerage</option>
      </select>
      <p className={hintClass}>
        {market
          ? `Holdings are looked up on the ${market} market.`
          : "The brokerage says which market the holdings trade on."}
      </p>
    </div>
  )
}

/** The account the holdings are recorded against, or one to create. */
export function AccountSelect({
  brokers,
  chosenId,
  firmChosen,
  failed,
  disabled,
  className,
  onChoose,
}: {
  /** The accounts at the chosen firm. */
  brokers: Broker[]
  /** An account id, CREATE_ACCOUNT, or "" when none is chosen. */
  chosenId: string
  firmChosen: boolean
  /** The accounts could not be loaded. */
  failed: boolean
  disabled: boolean
  className: string
  onChoose: (brokerId: string) => void
}): React.ReactElement {
  return (
    <div>
      <label htmlFor="import-brokerage-account" className="sr-only">
        Brokerage account
      </label>
      <select
        id="import-brokerage-account"
        required
        value={chosenId}
        disabled={disabled || !firmChosen}
        onChange={(event) => onChoose(event.target.value)}
        className={className}
      >
        <option value="">Choose a brokerage account…</option>
        <option value={CREATE_ACCOUNT}>Create Brokerage Account</option>
        {brokers.map((broker) => (
          <option key={broker.id} value={broker.id}>
            {brokerLabel(broker)}
          </option>
        ))}
      </select>
      {failed && (
        <Alert className="mt-2">
          Your brokerage accounts could not be loaded. Reload the page.
        </Alert>
      )}
      <p className={hintClass}>
        {firmChosen
          ? "The holdings are recorded against this account."
          : "Choose the brokerage first."}
      </p>
    </div>
  )
}

/** The account's name, with its number when it has one. */
export function brokerLabel(
  broker: Pick<Broker, "name" | "accountNumber">,
): string {
  return broker.accountNumber
    ? `${broker.name} (${broker.accountNumber})`
    : broker.name
}
