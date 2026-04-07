import React from "react"
import { useCompositeProjectionContext } from "./CompositeProjectionContext"

/**
 * Settings bar for the composite projection view.
 *
 * Renders the display-currency selector and a sustainability indicator
 * pill. Reads all state from {@link useCompositeProjectionContext}.
 */
export default function CompositeSettingsBar(): React.ReactElement {
  const { plans, displayCurrency, setDisplayCurrency, projection } =
    useCompositeProjectionContext()

  // Collect unique currencies from plans
  const currencies = Array.from(
    new Set(plans.map((p) => p.expensesCurrency).filter(Boolean)),
  )

  // Sustainability indicator
  const sustainabilityText = projection
    ? projection.isSustainable
      ? `Sustainable to age ${projection.yearlyProjections[projection.yearlyProjections.length - 1]?.age ?? "?"}`
      : `Depletes at age ${projection.depletionAge ?? "?"}`
    : null

  return (
    <div className="bg-white rounded-xl shadow-md p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label
            htmlFor="composite-currency"
            className="text-sm font-medium text-gray-700"
          >
            Display Currency
          </label>
          <select
            id="composite-currency"
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {sustainabilityText && (
          <span
            className={`ml-auto text-sm font-medium px-3 py-1 rounded-full ${
              projection?.isSustainable
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            <i
              className={`fas ${projection?.isSustainable ? "fa-check-circle" : "fa-exclamation-triangle"} mr-1`}
            ></i>
            {sustainabilityText}
          </span>
        )}
      </div>
    </div>
  )
}
