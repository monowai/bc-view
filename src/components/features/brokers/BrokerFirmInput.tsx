import React, { useState } from "react"
import type { GlobalBroker } from "types/beancounter"

const NOT_LISTED = "__not_listed__"

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

/** The firm's name to save: a listed firm's own spelling, else as typed. */
export function savedFirmName(firms: GlobalBroker[], typed: string): string {
  return listedFirm(firms, typed)?.name ?? typed.trim()
}

interface BrokerFirmInputProps {
  firms: GlobalBroker[]
  /** The firm's name: a listed firm's, or the one the user typed. */
  value: string
  onChange: (firmName: string) => void
  labelClassName: string
  inputClassName: string
}

/**
 * The brokerage firm of a new account. The user picks from the supported
 * firms; "Not listed" lets them type the firm's name. With no firms to offer,
 * the name is typed.
 */
export default function BrokerFirmInput({
  firms,
  value,
  onChange,
  labelClassName,
  inputClassName,
}: BrokerFirmInputProps): React.ReactElement {
  const [notListed, setNotListed] = useState(false)
  const picked = listedFirm(firms, value)
  // A name typed before the firms loaded stays a typed name.
  const typing =
    firms.length === 0 || notListed || (value.trim() !== "" && !picked)

  const pick = (choice: string): void => {
    setNotListed(choice === NOT_LISTED)
    onChange(firms.find((firm) => firm.id === choice)?.name ?? "")
  }

  return (
    <div className="space-y-3">
      {firms.length > 0 && (
        <div>
          <label htmlFor="broker-firm" className={labelClassName}>
            {"Brokerage firm"} *
          </label>
          <select
            id="broker-firm"
            required
            value={picked && !notListed ? picked.id : typing ? NOT_LISTED : ""}
            onChange={(e) => pick(e.target.value)}
            className={inputClassName}
            autoFocus
          >
            <option value="" disabled>
              {"Select a firm"}
            </option>
            {firms.map((firm) => (
              <option key={firm.id} value={firm.id}>
                {firm.name}
              </option>
            ))}
            <option value={NOT_LISTED}>{"Not listed"}</option>
          </select>
        </div>
      )}
      {typing && (
        <div>
          <label htmlFor="broker-firm-name" className={labelClassName}>
            {"Firm name"} *
          </label>
          <input
            id="broker-firm-name"
            type="text"
            required
            value={value}
            onChange={(e) => {
              // A typed name stays typed, even when it spells a listed firm.
              setNotListed(true)
              onChange(e.target.value)
            }}
            className={inputClassName}
            placeholder={"e.g., Interactive Brokers"}
            autoComplete="off"
            autoFocus={firms.length === 0}
          />
        </div>
      )}
    </div>
  )
}
