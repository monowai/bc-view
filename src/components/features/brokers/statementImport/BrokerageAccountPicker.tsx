import React from "react"
import Link from "next/link"
import Alert from "@components/ui/Alert"
import type { Broker } from "types/beancounter"

interface BrokerageAccountPickerProps {
  brokers: Broker[]
  /** The account chosen; "" when none is. */
  chosenId: string
  /** The accounts could not be loaded. */
  failed: boolean
  disabled: boolean
  className: string
  onChoose: (brokerId: string) => void
}

/** Whose brokerage account the screenshot is of: the holdings are recorded there. */
export default function BrokerageAccountPicker({
  brokers,
  chosenId,
  failed,
  disabled,
  className,
  onChoose,
}: BrokerageAccountPickerProps): React.ReactElement {
  return (
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
        disabled={disabled}
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
      <p className="text-xs text-gray-500 mt-1">
        The holdings are recorded against this account. Not listed?{" "}
        <Link href="/brokers" className="text-blue-600 underline">
          Add a brokerage account
        </Link>
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
