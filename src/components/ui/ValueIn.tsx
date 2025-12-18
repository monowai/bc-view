import React, { ReactElement, useCallback } from "react"
import { useHoldingState } from "@lib/holdings/holdingState"
import { ValuationOption, ValuationOptions } from "types/app"
import { useTranslation } from "next-i18next"
import { rootLoader } from "@components/ui/PageLoader"
import { Portfolio } from "types/beancounter"

export enum ValueIn {
  PORTFOLIO = "PORTFOLIO",
  BASE = "BASE",
  TRADE = "TRADE",
}

export function useValuationOptions(): ValuationOptions {
  const { t } = useTranslation("common")
  return {
    values: [
      { value: ValueIn.PORTFOLIO, label: t("in.portfolio") },
      { value: ValueIn.BASE, label: t("in.base") },
      { value: ValueIn.TRADE, label: t("in.trade") },
    ],
    valuationDefault: { value: ValueIn.PORTFOLIO, label: t("in.portfolio") },
  }
}

interface ValueInOptionProps {
  portfolio: Portfolio
  onOptionSelect: () => void
}

const ValueInOption: React.FC<ValueInOptionProps> = ({
  portfolio,
  onOptionSelect,
}): ReactElement => {
  const holdingState = useHoldingState()
  const { t, ready } = useTranslation("common")

  const handleSelectChange = useCallback(
    (selectedOption: ValuationOption) => {
      holdingState.setValueIn(selectedOption)
      onOptionSelect()
    },
    [holdingState, onOptionSelect],
  )

  if (!ready) {
    return rootLoader(t("loading"))
  }

  // Build options with currency codes
  const options: ValuationOption[] = [
    {
      value: ValueIn.PORTFOLIO,
      label: `${t("in.portfolio")} (${portfolio.currency.code})`,
    },
    {
      value: ValueIn.BASE,
      label: `${t("in.base")} (${portfolio.base.code})`,
    },
    { value: ValueIn.TRADE, label: t("in.trade") },
  ]

  return (
    <ul className="menu-list">
      {options.map((option) => (
        <li
          key={option.value}
          className="menu-item"
          onClick={() => handleSelectChange(option)}
        >
          {option.label}
          {holdingState.valueIn.value === option.value && (
            <span className="check-mark">&#10003;</span>
          )}
        </li>
      ))}
    </ul>
  )
}

export default React.memo(ValueInOption)
