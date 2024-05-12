import React, { ReactElement, useCallback } from "react";
import Select from "react-select";
import { useHoldingState } from "@utils/holdings/holdingState";
import { GroupOption, GroupOptions } from "@components/types/app";
import { useTranslation } from "next-i18next";
import { rootLoader } from "@components/PageLoader";

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
  const { t } = useTranslation("common");
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
  };
}

const GroupByOptions = (): ReactElement => {
  const holdingState = useHoldingState();
  const groupOptions = useGroupOptions();
  const { t, ready } = useTranslation("common");

  const handleSelectChange = useCallback(
    (selectedOption: GroupOption | null) => {
      if (selectedOption) {
        holdingState.setGroupBy(selectedOption);
      }
    },
    [holdingState],
  );

  if (!ready) {
    return rootLoader(t("loading"));
  }

  return (
    <Select
      options={groupOptions.values}
      defaultValue={holdingState.groupBy}
      isSearchable={false}
      isClearable={false}
      onChange={handleSelectChange}
    />
  );
};

export default React.memo(GroupByOptions);
