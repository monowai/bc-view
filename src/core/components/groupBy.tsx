import Select from "react-select";
import React from "react";
import { useHoldingState } from "@domain/holdings/holdingState";
import { GroupBy } from "@core/types/constants";
import { GroupOption, GroupOptions } from "@core/types/app";
import { useTranslation } from "next-i18next";
import { rootLoader } from "@core/common/PageLoader";

export function useGroupOptions(): GroupOptions {
  const { t } = useTranslation("common");
  return {
    groupDefault: {
      value: GroupBy.ASSET_CLASS,
      label: t("by.class"),
    },
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
  };
}

export function GroupByOption(): JSX.Element {
  const holdingState = useHoldingState();
  const groupOptions = useGroupOptions();
  const { t, ready } = useTranslation("common");
  if (!ready) {
    return rootLoader(t("loading"));
  }

  return (
    <Select
      options={groupOptions.values}
      defaultValue={holdingState.groupBy}
      isSearchable={false}
      isClearable={false}
      onChange={(e) => {
        holdingState.setGroupBy(e as GroupOption);
      }}
    />
  );
}
