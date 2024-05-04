import React, { ReactElement } from "react";
import { FormatNumber } from "@components/types/app";
import { NumericFormat } from "react-number-format";

export function FormatValue({
  value,
  scale,
  multiplier,
  defaultValue = " ",
}: FormatNumber): ReactElement {
  if (value) {
    return (
      <NumericFormat
        value={value * (multiplier ? multiplier : 1)}
        displayType={"text"}
        decimalScale={scale ? scale : 2}
        fixedDecimalScale={true}
        thousandSeparator={true}
      />
    );
  }
  return <span>{defaultValue}</span>;
}
