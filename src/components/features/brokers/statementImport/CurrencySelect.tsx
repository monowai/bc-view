import React from "react"
import useSwr from "swr"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import type { Currency } from "types/beancounter"

/** The currency of a portfolio the import creates. */
export default function CurrencySelect({
  id,
  value,
  disabled,
  className,
  onChange,
}: {
  id: string
  value: string
  disabled: boolean
  className: string
  onChange: (currency: string) => void
}): React.ReactElement {
  const { data, error } = useSwr<{ data: Currency[] }, Error>(
    ccyKey,
    simpleFetcher(ccyKey),
  )
  const codes = (data?.data ?? []).map((currency) => currency.code)
  // The chosen currency stays listed while the list loads.
  const options = codes.includes(value) ? codes : [value, ...codes]
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-gray-700 mb-1"
      >
        Currency
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      >
        {options.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-1">
        The new portfolio reports and keeps its costs in this currency.
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-600 mt-1">
          {`The currencies could not be loaded, so only ${value} can be chosen. Reload the page to choose another.`}
        </p>
      )}
    </div>
  )
}
