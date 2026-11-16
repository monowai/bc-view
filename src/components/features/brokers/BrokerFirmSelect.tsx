import React from "react"
import type { GlobalBroker } from "types/beancounter"

interface BrokerFirmSelectProps {
  firms: GlobalBroker[]
  value: string
  onChange: (globalBrokerId: string) => void
  /** Offer "Not listed", the choice of no firm. */
  allowNone: boolean
  selectClassName: string
}

/**
 * The choice of brokerage firm for a broker. Renders nothing when there are no
 * firms to choose from.
 */
export default function BrokerFirmSelect({
  firms,
  value,
  onChange,
  allowNone,
  selectClassName,
}: BrokerFirmSelectProps): React.ReactElement | null {
  if (firms.length === 0) return null
  return (
    <div>
      <label
        htmlFor="broker-firm"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {"Brokerage firm"}
      </label>
      <select
        id="broker-firm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClassName}
      >
        {allowNone && <option value="">{"Not listed"}</option>}
        {firms.map((firm) => (
          <option key={firm.id} value={firm.id}>
            {firm.name}
          </option>
        ))}
      </select>
    </div>
  )
}
