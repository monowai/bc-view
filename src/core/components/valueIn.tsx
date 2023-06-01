import { ValueIn } from "@core/types/constants";
import Select from "react-select";
import { useHoldingState } from "@domain/holdings/holdingState";
import { ValuationOption } from "@core/types/app";

export function valuationOptions(): ValuationOption[] {
  return [
    { value: ValueIn.PORTFOLIO, label: "Portfolio" },
    { value: ValueIn.BASE, label: "Base" },
    { value: ValueIn.TRADE, label: "Trade" },
  ];
}
export function ValueInOption(): JSX.Element {
  const holdingState = useHoldingState();
  return (
    <Select
      options={valuationOptions()}
      defaultValue={holdingState.valueIn}
      isSearchable={false}
      isClearable={false}
      onChange={(e) => {
        holdingState.setValueIn(e as ValuationOption);
      }}
    />
  );
}

export const defaultValueInOption = valuationOptions()[0];
