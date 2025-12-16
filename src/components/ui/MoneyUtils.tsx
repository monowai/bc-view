import React, { ReactElement } from "react"
import { FormatNumber } from "types/app"
import { NumericFormat } from "react-number-format"

export function FormatValue({
  value,
  scale,
  multiplier,
  defaultValue = " ",
}: FormatNumber): ReactElement {
  if (typeof value === "number") {
    return (
      <NumericFormat
        value={value * (multiplier ? multiplier : 1)}
        displayType={"text"}
        decimalScale={scale ? scale : 2}
        fixedDecimalScale={true}
        thousandSeparator={true}
      />
    )
  }
  return <span>{defaultValue}</span>
}

/**
 * Responsive FormatValue that shows dollars only on mobile portrait, full precision on landscape+
 * Mobile portrait (< 640px): No cents
 * Mobile landscape+ (>= 640px): Full precision with cents
 */
export function ResponsiveFormatValue({
  value,
  scale,
  multiplier,
  defaultValue = " ",
}: FormatNumber): ReactElement {
  if (typeof value !== "number") {
    return <span>{defaultValue}</span>
  }

  const computedValue = value * (multiplier ? multiplier : 1)
  const computedScale = scale !== undefined ? scale : 2

  return (
    <>
      {/* Mobile portrait: No decimals (dollars only) */}
      <span className="sm:hidden">
        <NumericFormat
          value={computedValue}
          displayType={"text"}
          decimalScale={0}
          fixedDecimalScale={false}
          thousandSeparator={true}
        />
      </span>
      {/* Mobile landscape and above: Full precision */}
      <span className="hidden sm:inline">
        <NumericFormat
          value={computedValue}
          displayType={"text"}
          decimalScale={computedScale}
          fixedDecimalScale={true}
          thousandSeparator={true}
        />
      </span>
    </>
  )
}
