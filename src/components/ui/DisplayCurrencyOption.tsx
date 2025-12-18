import React, { ReactElement, useCallback } from "react"
import { useHoldingState } from "@lib/holdings/holdingState"
import { useTranslation } from "next-i18next"
import { rootLoader } from "@components/ui/PageLoader"
import { Portfolio } from "types/beancounter"
import { DisplayCurrencyMode } from "types/app"
import { useCurrencies } from "@lib/hooks/useDisplayCurrencyConversion"

interface DisplayCurrencyOptionProps {
  portfolio: Portfolio
  onOptionSelect: () => void
}

const DisplayCurrencyOption: React.FC<DisplayCurrencyOptionProps> = ({
  portfolio,
  onOptionSelect,
}): ReactElement => {
  const holdingState = useHoldingState()
  const { t, ready } = useTranslation("common")
  const { currencies, isLoading: currenciesLoading } = useCurrencies()

  const displayCurrency = holdingState.displayCurrency
  const valueInMode = holdingState.valueIn.value as DisplayCurrencyMode

  const handleClearDisplayCurrency = useCallback(() => {
    // Reset to match Value In - no custom display currency
    holdingState.setDisplayCurrency({ mode: valueInMode })
    onOptionSelect()
  }, [holdingState, valueInMode, onOptionSelect])

  const handleCurrencySelect = useCallback(
    (code: string) => {
      holdingState.setDisplayCurrency({ mode: "CUSTOM", customCode: code })
      onOptionSelect()
    },
    [holdingState, onOptionSelect],
  )

  if (!ready || currenciesLoading) {
    return rootLoader(t("loading"))
  }

  // Filter out Portfolio and Base currencies - those are available via Value In
  const excludedCodes = new Set([portfolio.currency.code, portfolio.base.code])
  const availableCurrencies = currencies.filter(
    (c) => !excludedCodes.has(c.code),
  )

  const isCustomSelected = displayCurrency.mode === "CUSTOM"

  return (
    <div className="space-y-2">
      <ul className="menu-list max-h-48 overflow-y-auto">
        {/* None option - clears custom display currency */}
        <li className="menu-item" onClick={handleClearDisplayCurrency}>
          {t("displayCurrency.none", "None")}
          {!isCustomSelected && <span className="check-mark">&#10003;</span>}
        </li>
        {/* Separator */}
        <li className="border-t border-gray-200 my-1" />
        {/* Warning for custom currencies */}
        <li className="text-xs text-gray-500 px-2 py-1">
          {t("displayCurrency.warning")} ⚠
        </li>
        {availableCurrencies.map((currency) => (
          <li
            key={currency.code}
            className="menu-item"
            onClick={() => handleCurrencySelect(currency.code)}
          >
            {currency.code} ({currency.symbol})
            {isCustomSelected &&
              displayCurrency.customCode === currency.code && (
                <span className="check-mark">&#10003;</span>
              )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default React.memo(DisplayCurrencyOption)
