import Select from "react-select";
import React from "react";
import { useHoldingState } from "@domain/holdings/holdingState";
import { GroupBy } from "@core/types/constants";
import { GroupOption } from "@core/types/app";

function groupOptions(): GroupOption[] {
  return [
    {
      value: GroupBy.ASSET_CLASS,
      label: "Asset Class",
    },
    {
      value: GroupBy.MARKET_CURRENCY,
      label: "Currency",
    },
    { value: GroupBy.MARKET, label: "Market" },
  ];
}
export function GroupByOption(): JSX.Element {
  const holdingState = useHoldingState();
  return (
    <Select
      options={groupOptions()}
      defaultValue={holdingState.groupBy}
      isSearchable={false}
      isClearable={false}
      onChange={(e) => {
        holdingState.setGroupBy(e as GroupOption);
      }}
    />
  );
}

export const defaultGroupBy = groupOptions()[0];
