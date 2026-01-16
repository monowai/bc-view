import React from "react"
import Link from "next/link"

interface CurrencyOption {
  code: string
  label?: string
}

interface PlanViewHeaderProps {
  /** Plan name to display */
  planName: string
  /** Plan ID for edit link */
  planId: string
  /** Planning horizon in years */
  planningHorizonYears: number
  /** Plan's base currency */
  planCurrency: string
  /** Currently selected display currency (null = use plan currency) */
  displayCurrency: string | null
  /** Available currencies for display */
  availableCurrencies: CurrencyOption[]
  /** Callback when display currency changes */
  onCurrencyChange: (currency: string | null) => void
  /** Callback when export is clicked */
  onExport: () => void
}

/**
 * Compact header for plan view with navigation, currency selector, and actions.
 */
export default function PlanViewHeader({
  planName,
  planId,
  planningHorizonYears,
  planCurrency,
  displayCurrency,
  availableCurrencies,
  onCurrencyChange,
  onExport,
}: PlanViewHeaderProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-4">
        <Link
          href="/independence"
          className="text-gray-400 hover:text-orange-600 transition-colors"
          title="Back to Plans"
        >
          <i className="fas fa-arrow-left"></i>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{planName}</h1>
          <p className="text-sm text-gray-500">
            {planningHorizonYears} year horizon
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* Currency selector */}
        <select
          value={displayCurrency || planCurrency}
          onChange={(e) =>
            onCurrencyChange(
              e.target.value === planCurrency ? null : e.target.value,
            )
          }
          className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
          title="Display currency"
        >
          {availableCurrencies.map((curr) => (
            <option key={curr.code} value={curr.code}>
              {curr.code}
            </option>
          ))}
        </select>
        <button
          onClick={onExport}
          className="text-gray-400 hover:text-gray-600 p-2"
          title="Export plan as JSON"
        >
          <i className="fas fa-download"></i>
        </button>
        <Link
          href={`/independence/wizard/${planId}`}
          className="text-orange-600 hover:text-orange-700 text-sm font-medium"
        >
          <i className="fas fa-edit mr-1"></i>
          Edit
        </Link>
      </div>
    </div>
  )
}
