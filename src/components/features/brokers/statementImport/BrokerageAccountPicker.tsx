import React from "react"
import Link from "next/link"
import Alert from "@components/ui/Alert"
import { useBrokers } from "@hooks/useBrokers"
import type { MatchedBroker } from "types/beancounter"

interface BrokerageAccountPickerProps {
  /** The account the preview is for, or null when none fits the screenshot. */
  matched: MatchedBroker | null
  /** The account the user picked; "" when they have picked none. */
  chosenId: string
  disabled: boolean
  onChoose: (brokerId: string) => void
}

/**
 * Whose brokerage account the screenshot is of. Beancounter's own match is
 * stated; when it found none, or the user has overruled it, the user picks.
 */
export default function BrokerageAccountPicker({
  matched,
  chosenId,
  disabled,
  onChoose,
}: BrokerageAccountPickerProps): React.ReactElement {
  const { brokers, error } = useBrokers()
  const choices = brokers.filter(
    (broker) => broker.active !== false || broker.id === chosenId,
  )
  const picking = chosenId !== "" || !matched

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-sm">
      {picking ? (
        <>
          <label
            htmlFor="import-brokerage-account"
            className="block font-semibold text-gray-900 mb-1"
          >
            Brokerage account
          </label>
          {!matched && chosenId === "" && (
            <p className="text-gray-600 mb-2">
              None of your brokerage accounts matches this screenshot. Choose
              the one it shows.
            </p>
          )}
          <select
            id="import-brokerage-account"
            required
            value={chosenId}
            disabled={disabled}
            onChange={(event) => onChoose(event.target.value)}
            className="w-full sm:w-80 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a brokerage account…</option>
            {choices.map((broker) => (
              <option key={broker.id} value={broker.id}>
                {broker.accountNumber
                  ? `${broker.name} (${broker.accountNumber})`
                  : broker.name}
              </option>
            ))}
          </select>
          {error && (
            <Alert className="mt-2">
              Your brokerage accounts could not be loaded. Reload the page.
            </Alert>
          )}
          <p className="mt-2 text-gray-600">
            Not listed?{" "}
            <Link href="/brokers" className="text-blue-600 underline">
              Add a brokerage account
            </Link>
          </p>
        </>
      ) : (
        <>
          <h3 className="font-semibold text-gray-900 mb-1">
            Brokerage account
          </h3>
          <p className="text-gray-900">
            {matched.accountNumber
              ? `${matched.name} (${matched.accountNumber})`
              : matched.name}
          </p>
          <p className="text-gray-600 mt-1">
            Matched from the brokerage name and account digits on the
            screenshot.
          </p>
        </>
      )}
    </section>
  )
}
