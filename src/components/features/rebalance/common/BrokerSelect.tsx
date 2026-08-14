import React from "react"

/** Structural subset shared by `Broker` and `BrokerWithAccounts` — the two
 *  call sites fetch brokers via different endpoints (one with settlement
 *  accounts, one without), but the select only ever needs id/name/account
 *  number. */
export interface SelectableBroker {
  id: string
  name: string
  accountNumber?: string
}

interface BrokerSelectProps {
  brokers: SelectableBroker[]
  value: string | undefined
  onChange: (brokerId: string | undefined) => void
  /** Callers own their surrounding label/heading markup, which differs
   *  between the adhoc execute wizard and the Invest Cash dialog — only the
   *  select itself is shared, so each call site passes its exact existing
   *  className to keep styling pixel-identical. */
  className: string
  /** Optional id, forwarded to the <select> so a caller's <label htmlFor>
   *  can associate with it. */
  id?: string
}

/**
 * The broker-picker <select> shared by the rebalance execution flows.
 */
const BrokerSelect: React.FC<BrokerSelectProps> = ({
  brokers,
  value,
  onChange,
  className,
  id,
}) => (
  <select
    id={id}
    value={value || ""}
    onChange={(e) => onChange(e.target.value || undefined)}
    className={className}
  >
    <option value="">{"-- No broker --"}</option>
    {brokers.map((broker) => (
      <option key={broker.id} value={broker.id}>
        {broker.name}
        {broker.accountNumber ? ` (${broker.accountNumber})` : ""}
      </option>
    ))}
  </select>
)

export default BrokerSelect

/**
 * Shared "no broker tagged" confirm gate used before committing proposed
 * transactions when more than one broker exists and none was picked.
 * Returns true when it's fine to proceed — a broker is selected, there's
 * one broker or none at all, or the user confirmed anyway.
 */
export function confirmBrokerSelection(
  brokerCount: number,
  selectedBrokerId: string | undefined,
): boolean {
  if (brokerCount > 1 && !selectedBrokerId) {
    return window.confirm(
      "No broker selected. Your proposed transactions won't be tagged with a broker. Continue?",
    )
  }
  return true
}
