import React, { ReactElement, useCallback } from "react"
import { useHoldingState } from "@lib/holdings/holdingState"
import { ValuationOption, ValuationOptions } from "types/app"
import { Portfolio } from "types/beancounter"
import {
  VALUE_IN_OPTIONS,
  type ValueInOption as ValueInOptionType,
} from "types/constants"

// Re-export for backward compatibility
export const ValueIn = VALUE_IN_OPTIONS
export type ValueIn = ValueInOptionType

export function useValuationOptions(): ValuationOptions {
  return {
    values: [
      { value: VALUE_IN_OPTIONS.PORTFOLIO, label: "Portfolio" },
      { value: VALUE_IN_OPTIONS.BASE, label: "Base" },
      { value: VALUE_IN_OPTIONS.TRADE, label: "Trade" },
    ],
    valuationDefault: {
      value: VALUE_IN_OPTIONS.PORTFOLIO,
      label: "Portfolio",
    },
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
  const handleSelectChange = useCallback(
    (selectedOption: ValuationOption) => {
      holdingState.setValueIn(selectedOption)
      onOptionSelect()
    },
    [holdingState, onOptionSelect],
  )

  // Build options with currency codes
  const options: ValuationOption[] = [
    {
      value: ValueIn.PORTFOLIO,
      label: `${"Portfolio"} (${portfolio.currency.code})`,
    },
    {
      value: ValueIn.BASE,
      label: `${"Base"} (${portfolio.base.code})`,
    },
    { value: ValueIn.TRADE, label: "Trade" },
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
