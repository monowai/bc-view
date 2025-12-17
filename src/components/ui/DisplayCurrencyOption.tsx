import React, { ReactElement, useCallback, useEffect, useState } from "react"
import { useHoldingState } from "@lib/holdings/holdingState"
import { useTranslation } from "next-i18next"
import { rootLoader } from "@components/ui/PageLoader"
import { Currency, Portfolio } from "types/beancounter"
import { DisplayCurrencyMode } from "types/app"

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
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [showCustomPicker, setShowCustomPicker] = useState(false)

  const displayCurrency = holdingState.displayCurrency

  // Fetch available currencies
  useEffect(() => {
    fetch("/api/currencies")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setCurrencies(data.data)
        }
      })
      .catch(console.error)
  }, [])

  const handleModeSelect = useCallback(
    (mode: DisplayCurrencyMode) => {
      if (mode === "CUSTOM") {
        setShowCustomPicker(true)
      } else {
        holdingState.setDisplayCurrency({ mode })
        onOptionSelect()
      }
    },
    [holdingState, onOptionSelect],
  )

  const handleCustomCurrencySelect = useCallback(
    (code: string) => {
      // Check if selected currency matches Portfolio, Base, or Trade
      if (code === portfolio.currency.code) {
        holdingState.setDisplayCurrency({ mode: "PORTFOLIO" })
      } else if (code === portfolio.base.code) {
        holdingState.setDisplayCurrency({ mode: "BASE" })
      } else {
        holdingState.setDisplayCurrency({ mode: "CUSTOM", customCode: code })
      }
      setShowCustomPicker(false)
      onOptionSelect()
    },
    [holdingState, portfolio, onOptionSelect],
  )

  if (!ready) {
    return rootLoader(t("loading"))
  }

  const options: { mode: DisplayCurrencyMode; label: string }[] = [
    {
      mode: "PORTFOLIO",
      label: `${t("displayCurrency.portfolio", "Portfolio")} (${portfolio.currency.code})`,
    },
    {
      mode: "BASE",
      label: `${t("displayCurrency.base", "Base")} (${portfolio.base.code})`,
    },
    {
      mode: "TRADE",
      label: t("displayCurrency.trade", "Trade"),
    },
    {
      mode: "CUSTOM",
      label:
        displayCurrency.mode === "CUSTOM" && displayCurrency.customCode
          ? `${t("displayCurrency.other", "Other")} (${displayCurrency.customCode})`
          : t("displayCurrency.other", "Other..."),
    },
  ]

  if (showCustomPicker) {
    return (
      <div className="space-y-2">
        <button
          className="text-sm text-blue-600 hover:text-blue-800"
          onClick={() => setShowCustomPicker(false)}
        >
          ← {t("back", "Back")}
        </button>
        <ul className="menu-list max-h-48 overflow-y-auto">
          {currencies.map((currency) => (
            <li
              key={currency.code}
              className="menu-item"
              onClick={() => handleCustomCurrencySelect(currency.code)}
            >
              {currency.code} ({currency.symbol})
              {displayCurrency.mode === "CUSTOM" &&
                displayCurrency.customCode === currency.code && (
                  <span className="check-mark">&#10003;</span>
                )}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <ul className="menu-list">
      {options.map((option) => (
        <li
          key={option.mode}
          className="menu-item"
          onClick={() => handleModeSelect(option.mode)}
        >
          {option.label}
          {displayCurrency.mode === option.mode && (
            <span className="check-mark">&#10003;</span>
          )}
        </li>
      ))}
    </ul>
  )
}

export default React.memo(DisplayCurrencyOption)
