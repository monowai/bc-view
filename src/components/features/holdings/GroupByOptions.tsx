import React, { ReactElement, useCallback } from "react"
import { useHoldingState } from "@lib/holdings/holdingState"
import { GroupOption, GroupOptions } from "types/app"
import { useTranslation } from "next-i18next"
import { rootLoader } from "@components/ui/PageLoader"
import { GroupingMode } from "@lib/allocation/aggregateHoldings"
import {
  GROUP_BY_OPTIONS,
  type GroupByOption as GroupByOptionType,
  VALUE_IN_OPTIONS,
  type ValueInOption as ValueInOptionType,
} from "types/constants"

// Re-export for backward compatibility
export const GroupBy = GROUP_BY_OPTIONS
export type GroupBy = GroupByOptionType

// Re-export ValueIn for backward compatibility
export const ValueIn = VALUE_IN_OPTIONS
export type ValueIn = ValueInOptionType

/**
 * Maps table GroupBy to allocation chart GroupingMode.
 * Used to synchronize grouping between table/heatmap and allocation views.
 */
export function toAllocationGroupBy(
  groupBy: GroupByOptionType | string,
): GroupingMode {
  switch (groupBy) {
    case GROUP_BY_OPTIONS.ASSET_CLASS:
      return "category"
    case GROUP_BY_OPTIONS.SECTOR:
      return "sector"
    case GROUP_BY_OPTIONS.MARKET:
    case GROUP_BY_OPTIONS.MARKET_CURRENCY:
      return "market"
    default:
      return "category"
  }
}

export function useGroupOptions(): GroupOptions {
  const { t } = useTranslation("common")
  return {
    values: [
      {
        value: GROUP_BY_OPTIONS.ASSET_CLASS,
        label: t("by.class"),
      },
      {
        value: GROUP_BY_OPTIONS.SECTOR,
        label: t("by.sector"),
      },
      {
        value: GROUP_BY_OPTIONS.MARKET_CURRENCY,
        label: t("by.currency"),
      },
      {
        value: GROUP_BY_OPTIONS.MARKET,
        label: t("by.market"),
      },
    ],
    groupDefault: {
      value: GROUP_BY_OPTIONS.ASSET_CLASS,
      label: t("by.class"),
    },
  }
}

interface GroupByOptionsProps {
  onOptionSelect: () => void
}

const GroupByOptions: React.FC<GroupByOptionsProps> = ({
  onOptionSelect,
}): ReactElement => {
  const holdingState = useHoldingState()
  const groupOptions = useGroupOptions()
  const { t, ready } = useTranslation("common")

  const handleSelectChange = useCallback(
    (selectedOption: GroupOption) => {
      holdingState.setGroupBy(selectedOption)
      onOptionSelect()
    },
    [holdingState, onOptionSelect],
  )

  if (!ready) {
    return rootLoader(t("loading"))
  }

  return (
    <ul className="menu-list">
      {groupOptions.values.map((option) => (
        <li
          key={option.value}
          className="menu-item"
          onClick={() => handleSelectChange(option)}
        >
          {option.label}
          {holdingState.groupBy.value === option.value && (
            <span className="check-mark">&#10003;</span>
          )}
        </li>
      ))}
    </ul>
  )
}

export default GroupByOptions
