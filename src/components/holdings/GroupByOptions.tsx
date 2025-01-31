import React, { ReactElement, useCallback } from "react"
import { useHoldingState } from "@utils/holdings/holdingState"
import { GroupOption, GroupOptions } from "types/app"
import { useTranslation } from "next-i18next"
import { rootLoader } from "@components/PageLoader"

export enum GroupBy {
  MARKET_CURRENCY = "asset.market.currency.code",
  MARKET = "asset.market.code",
  ASSET_CLASS = "asset.assetCategory.name",
}

export enum ValueIn {
  PORTFOLIO = "PORTFOLIO",
  BASE = "BASE",
  TRADE = "TRADE",
}

export function useGroupOptions(): GroupOptions {
  const { t } = useTranslation("common")
  return {
    values: [
      {
        value: GroupBy.ASSET_CLASS,
        label: t("by.class"),
      },
      {
        value: GroupBy.MARKET_CURRENCY,
        label: t("by.currency"),
      },
      {
        value: GroupBy.MARKET,
        label: t("by.market"),
      },
    ],
    groupDefault: {
      value: GroupBy.ASSET_CLASS,
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
