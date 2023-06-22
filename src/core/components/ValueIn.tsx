import { ValueIn } from "@core/types/constants";
import Select from "react-select";
import { useHoldingState } from "@domain/holdings/holdingState";
import { ValuationOption, ValuationOptions } from "@core/types/app";
import { useTranslation } from "next-i18next";
import {ReactElement} from "react";

export function useValuationOptions(): ValuationOptions {
  const { t } = useTranslation("common");
  return {
    values: [
      { value: ValueIn.PORTFOLIO, label: t("in.portfolio") },
      { value: ValueIn.BASE, label: t("in.base") },
      { value: ValueIn.TRADE, label: t("in.trade") },
    ],
    valuationDefault: { value: ValueIn.PORTFOLIO, label: t("in.portfolio") },
  };
}

export function ValueInOption(): ReactElement {
  const holdingState = useHoldingState();
  const valuationOptions = useValuationOptions();
  return (
    <Select
      options={valuationOptions.values}
      defaultValue={holdingState.valueIn}
      isSearchable={false}
      isClearable={false}
      onChange={(e) => {
        holdingState.setValueIn(e as ValuationOption);
      }}
    />
  );
}
