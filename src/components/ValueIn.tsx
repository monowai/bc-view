import Select from "react-select";
import { useHoldingState } from "@utils/holdings/holdingState";
import { useTranslation } from "next-i18next";
import { ValuationOption, ValuationOptions } from "@components/types/app";
import { ValueIn } from "@components/holdings/GroupByOptions";
import React from "react";

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

export const ValueInOption: React.FC = () => {
  const { valueIn, setValueIn } = useHoldingState();
  const valuationOptions = useValuationOptions();

  const handleChange = (option: ValuationOption | null): void => {
    if (option !== null) {
      setValueIn(option);
    }
  };

  return (
    <Select
      options={valuationOptions.values}
      defaultValue={valueIn}
      isSearchable={false}
      isClearable={false}
      onChange={handleChange}
    />
  );
};
