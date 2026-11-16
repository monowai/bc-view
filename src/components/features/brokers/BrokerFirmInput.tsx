import React from "react"
import type { GlobalBroker } from "types/beancounter"

/** The listed firm a typed name means, whatever its case. */
export function listedFirm(
  firms: GlobalBroker[],
  typed: string,
): GlobalBroker | undefined {
  const name = typed.trim().toLowerCase()
  return name
    ? firms.find((firm) => firm.name.toLowerCase() === name)
    : undefined
}

interface BrokerFirmInputProps {
  firms: GlobalBroker[]
  value: string
  onChange: (typed: string) => void
  labelClassName: string
  inputClassName: string
}

/**
 * The brokerage firm of a new account: the user picks a listed firm or types
 * one that is not listed.
 */
export default function BrokerFirmInput({
  firms,
  value,
  onChange,
  labelClassName,
  inputClassName,
}: BrokerFirmInputProps): React.ReactElement {
  const unlisted =
    firms.length > 0 && value.trim() !== "" && !listedFirm(firms, value)
  return (
    <div>
      <label htmlFor="broker-firm" className={labelClassName}>
        {"Brokerage firm"} *
      </label>
      <input
        id="broker-firm"
        type="text"
        required
        list="broker-firm-list"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClassName}
        placeholder={"e.g., Interactive Brokers"}
        autoComplete="off"
        aria-describedby={unlisted ? "broker-firm-hint" : undefined}
        autoFocus
      />
      <datalist id="broker-firm-list">
        {firms.map((firm) => (
          <option key={firm.id} value={firm.name} />
        ))}
      </datalist>
      {unlisted && (
        <p id="broker-firm-hint" className="mt-1 text-xs text-gray-500">
          {"Not a listed firm. It is saved on your account only."}
        </p>
      )}
    </div>
  )
}
