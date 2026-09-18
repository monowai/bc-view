import React from "react"
import type { RetirementPlan } from "types/independence"

interface DisplayCurrencyPickerProps {
  plans: RetirementPlan[]
  value: string
  onChange: (currency: string) => void
}

/**
 * Currency the composite projection is normalised into.
 *
 * A plan-shape decision, so it sits with the other levers rather than under
 * "About you" — and it goes through the composite context, which is the one
 * writer of `journey.displayCurrency`. Its predecessor wrote
 * `settings.compositeDisplayCurrency`, which nothing has read since the
 * composite moved onto the journey.
 */
export default function DisplayCurrencyPicker({
  plans,
  value,
  onChange,
}: DisplayCurrencyPickerProps): React.ReactElement | null {
  const planCurrencies = plans
    .map((plan) => plan.expensesCurrency)
    .filter(Boolean)
  // The journey's saved currency is not guaranteed to still be one a stage
  // uses — a stage can be re-denominated or removed after the choice was made.
  // Keeping it in the list is what makes the control honest: dropping it would
  // leave a controlled select showing the first option while state held
  // something else, so the plan would be normalised into a currency the screen
  // never named. It remains a legitimate conversion target either way.
  const currencies = Array.from(
    new Set([...planCurrencies, value].filter(Boolean)),
  )
  if (currencies.length < 2) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <label
          htmlFor="journey-display-currency"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Show this plan in
        </label>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Your stages span more than one currency; totals are converted into
          this one.
        </p>
      </div>
      <select
        id="journey-display-currency"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-independence-500 focus:ring-2 focus:ring-independence-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      >
        {currencies.map((currency) => (
          <option key={currency} value={currency}>
            {currency}
          </option>
        ))}
      </select>
    </div>
  )
}
