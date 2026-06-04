import React, { useState } from "react"
import { Currency } from "types/beancounter"

interface CurrencyStepProps {
  currencies: Currency[]
  baseCurrency: string
  reportingCurrency: string
  onBaseCurrencyChange: (currency: string) => void
  onReportingCurrencyChange: (currency: string) => void
}

const CurrencyStep: React.FC<CurrencyStepProps> = ({
  currencies,
  baseCurrency,
  reportingCurrency,
  onBaseCurrencyChange,
  onReportingCurrencyChange,
}) => {
  // Default to same currency for simplicity
  const [useSameCurrency, setUseSameCurrency] = useState(true)

  const handleBaseCurrencyChange = (code: string): void => {
    onBaseCurrencyChange(code)
    if (useSameCurrency) {
      onReportingCurrencyChange(code)
    }
  }

  const handleToggleSameCurrency = (): void => {
    const newValue = !useSameCurrency
    setUseSameCurrency(newValue)
    if (newValue) {
      onReportingCurrencyChange(baseCurrency)
    }
  }

  return (
    <div className="py-2">
      {/* Base Currency */}
      <div className="mb-3">
        <h3 className="text-sm font-medium text-gray-900 mb-1">
          {"Base Currency"}
          {!baseCurrency && (
            <span className="ml-2 text-xs text-orange-600 font-normal">
              {"(please select)"}
            </span>
          )}
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {currencies.map((currency) => (
            <button
              key={currency.code}
              type="button"
              onClick={() => handleBaseCurrencyChange(currency.code)}
              className={`px-2 py-1.5 rounded border-2 text-left transition-all text-sm ${
                baseCurrency === currency.code
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-gray-900">
                {currency.symbol} {currency.code}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Same currency toggle */}
      <label className="flex items-center cursor-pointer mb-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={useSameCurrency}
          onChange={handleToggleSameCurrency}
          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        <span className="ml-2">
          {"Use the same currency for reporting values"}
        </span>
      </label>

      {/* Reporting Currency - only show if different from base */}
      {!useSameCurrency && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-1">
            {"Reporting Currency"}
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {currencies.map((currency) => (
              <button
                key={currency.code}
                type="button"
                onClick={() => onReportingCurrencyChange(currency.code)}
                className={`px-2 py-1.5 rounded border-2 text-left transition-all text-sm ${
                  reportingCurrency === currency.code
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-gray-900">
                  {currency.symbol} {currency.code}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default CurrencyStep
