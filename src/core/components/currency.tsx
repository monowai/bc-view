import React from "react";
import { Currency, CurrencySelectorOptions } from "@core/types/beancounter";
import Select from "react-select";

export function CurrencySelector({
  defaultValue,
  placeHolder,
  xFunc,
  currencyOptions,
}: CurrencySelectorOptions): JSX.Element {
  return (
    <Select
      options={currencyOptions}
      placeholder={placeHolder}
      defaultValue={{ label: defaultValue.code, value: defaultValue.code }}
      isSearchable={false}
      isClearable={false}
      onChange={...xFunc}
    ></Select>
  );
}

export function currencyOptions(currencies: Currency[]): {} {
  return currencies.map((currency) => {
    return { value: currency.code, label: currency.code };
  });
}
