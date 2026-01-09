import React, { useState } from "react"
import { useTranslation } from "next-i18next"
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
  const { t } = useTranslation("onboarding")
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
    <div className="py-4">
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {t("currency.title", "Select your currency")}
      </h2>

      <p className="text-gray-600 mb-6">
        {t(
          "currency.description",
          "Select the currency you primarily use. This will be used for tracking costs and displaying values.",
        )}
      </p>

      {/* Base Currency */}
      <div className="mb-6">
        <h3 className="font-medium text-gray-900 mb-2">
          {t("currency.base", "Your Currency")}
          {!baseCurrency && (
            <span className="ml-2 text-sm text-orange-600 font-normal">
              {t("currency.pleaseSelect", "(please select)")}
            </span>
          )}
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          {t(
            "currency.baseDescription",
            "Used for cost tracking and as the default for new portfolios.",
          )}
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          {currencies.map((currency) => (
            <button
              key={currency.code}
              type="button"
              onClick={() => handleBaseCurrencyChange(currency.code)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                baseCurrency === currency.code
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-gray-900">
                {currency.symbol} {currency.code}
              </div>
              <div className="text-xs text-gray-500">{currency.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Same currency toggle */}
      <div className="mb-6">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={useSameCurrency}
            onChange={handleToggleSameCurrency}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="ml-2 text-gray-700">
            {t(
              "currency.useSame",
              "Use the same currency for reporting values",
            )}
          </span>
        </label>
      </div>

      {/* Reporting Currency - only show if different from base */}
      {!useSameCurrency && (
        <div>
          <h3 className="font-medium text-gray-900 mb-2">
            {t("currency.reporting", "Reporting Currency")}
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            {t(
              "currency.reportingDescription",
              "The currency used to display portfolio values and reports.",
            )}
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {currencies.map((currency) => (
              <button
                key={currency.code}
                type="button"
                onClick={() => onReportingCurrencyChange(currency.code)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  reportingCurrency === currency.code
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-gray-900">
                  {currency.symbol} {currency.code}
                </div>
                <div className="text-xs text-gray-500">{currency.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default CurrencyStep
