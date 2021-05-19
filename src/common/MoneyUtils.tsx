import NumberFormat from "react-number-format";
import React from "react";
import { FormatNumber } from "../types/app";

export function FormatValue({ value, scale, multiplier }: FormatNumber): JSX.Element {
  if (value) {
    return (
      <NumberFormat
        value={value * (multiplier ? multiplier : 1)}
        displayType={"text"}
        decimalScale={scale ? scale : 2}
        fixedDecimalScale={true}
        thousandSeparator={true}
      />
    );
  }
  return <span>-</span>;
}
