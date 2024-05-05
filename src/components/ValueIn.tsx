import Select from "react-select";
import { useHoldingState } from "@utils/holdings/holdingState";
import { useTranslation } from "next-i18next";
import { ReactElement } from "react";
import { ValueIn } from "@components/types/constants";
import { ValuationOption, ValuationOptions } from "@components/types/app";

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
  const { valueIn, setValueIn } = useHoldingState();
  const valuationOptions = useValuationOptions();

  const handleChange = (option: ValuationOption | null) => {
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
}
