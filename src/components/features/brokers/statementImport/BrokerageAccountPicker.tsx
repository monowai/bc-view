import React from "react"
import Link from "next/link"
import Alert from "@components/ui/Alert"
import type { Broker, GlobalBroker } from "types/beancounter"

/** The Brokerage choice for a firm Beancounter does not list. */
export const OTHER_FIRM = "__OTHER__"

interface BrokerageAccountPickerProps {
  firms: GlobalBroker[]
  /** The firm chosen: a firm id, OTHER_FIRM, or "" when none is. */
  firmId: string
  /** The accounts offered at that firm. */
  brokers: Broker[]
  /** The account chosen; "" when none is. */
  chosenId: string
  /** The chosen account will be linked to the chosen firm on Read. */
  linking: boolean
  /** The accounts could not be loaded. */
  failed: boolean
  disabled: boolean
  className: string
  onChooseFirm: (firmId: string) => void
  onChoose: (brokerId: string) => void
}

/**
 * Whose brokerage account the screenshot is of. The firm says which market the
 * holdings trade on; the account is where they are recorded.
 */
export default function BrokerageAccountPicker({
  firms,
  firmId,
  brokers,
  chosenId,
  linking,
  failed,
  disabled,
  className,
  onChooseFirm,
  onChoose,
}: BrokerageAccountPickerProps): React.ReactElement {
  const firm = firms.find((candidate) => candidate.id === firmId)
  const market = firm?.config?.market
  const account = brokers.find((candidate) => candidate.id === chosenId)

  return (
    <>
      <div>
        <label
          htmlFor="import-brokerage"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Brokerage
        </label>
        <select
          id="import-brokerage"
          required
          value={firmId}
          disabled={disabled}
          onChange={(event) => onChooseFirm(event.target.value)}
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
        <p className="text-xs text-gray-500 mt-1">
          {market
            ? `Holdings are looked up on the ${market} market.`
            : "The brokerage says which market the holdings trade on."}
        </p>
      </div>

      <div>
        <label
          htmlFor="import-brokerage-account"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Brokerage account
        </label>
        <select
          id="import-brokerage-account"
          required
          value={chosenId}
          disabled={disabled || firmId === ""}
          onChange={(event) => onChoose(event.target.value)}
          className={className}
        >
          <option value="">Choose a brokerage account…</option>
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
        {linking && account && firm && (
          <p className="text-xs text-gray-700 mt-1">
            {`${account.name} will be linked to ${firm.name} when the screenshot is read.`}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          The holdings are recorded against this account. Not listed?{" "}
          <Link href="/brokers" className="text-blue-600 underline">
            Add a brokerage account
          </Link>
        </p>
      </div>
    </>
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
