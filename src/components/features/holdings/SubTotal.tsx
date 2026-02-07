import React, { ReactElement } from "react"
import { GroupedSubtotals } from "types/beancounter"
import { FormatValue, ResponsiveFormatValue } from "@components/ui/MoneyUtils"
import { headers } from "./Header"
import { useTranslation } from "next-i18next"

interface SubTotalProps extends GroupedSubtotals {
  positionCount: number
}

// Helper function to generate responsive classes for table cells
const getCellClasses = (headerIndex: number): string => {
  const header = headers[headerIndex]
  let visibility
  if ("hidden" in header && header.hidden) {
    visibility = "hidden" // Hidden on all screens
  } else if (header.mobile) {
    visibility = ""
  } else if (header.medium) {
    visibility = "hidden sm:table-cell" // Hidden on mobile portrait, visible on landscape (640px+)
  } else {
    visibility = "hidden xl:table-cell"
  }
  const align = header.align === "center" ? "text-center" : "text-right"

  // Apply same padding logic as Header and Rows
  const padding = "px-0.5 py-1.5 sm:px-1 md:px-2 xl:px-3"

  // Monospace for numeric columns
  const isNumeric =
    headerIndex === 0 || // price
    headerIndex === 4 || // cost
    headerIndex === 5 || // market value
    headerIndex === 7 || // dividends
    headerIndex === 8 || // unrealised gain
    headerIndex === 9 || // realised gain
    headerIndex === 12 // total gain
  const fontClass = isNumeric ? "font-mono tabular-nums" : ""

  return `${padding} ${align} ${visibility} ${fontClass}`
}

export default function SubTotal({
  groupBy,
  subTotals,
  valueIn,
  positionCount,
}: SubTotalProps): ReactElement | null {
  const { t } = useTranslation("common")

  // Skip subtotal when there's only 1 position - it would duplicate the row values
  if (positionCount <= 1) {
    return null
  }
  // Define data array that matches the header structure
  const gainOnDay = subTotals[valueIn].gainOnDay
  const isCashGroup = groupBy.toLowerCase() === "cash"

  // Don't show change values for Cash groups
  const gainOnDayElement = isCashGroup ? (
    "-"
  ) : (
    <span
      key="gainOnDay"
      className={`font-mono tabular-nums ${gainOnDay < 0 ? "text-red-600" : gainOnDay > 0 ? "text-emerald-600" : "text-slate-600"}`}
    >
      <ResponsiveFormatValue value={gainOnDay} />
    </span>
  )

  const data = [
    "-", // asset.price column
    gainOnDayElement, // asset.change - shows gainOnDay sum on mobile (hidden for Cash)
    gainOnDayElement, // gain.onday (hidden)
    "-", // quantity
    <ResponsiveFormatValue
      key="costValue"
      value={subTotals[valueIn].costValue}
    />, // cost
    <ResponsiveFormatValue
      key="marketValue"
      value={subTotals[valueIn].marketValue}
    />, // summary.value
    <span key="irr" className="group relative cursor-help text-slate-400">
      -
      <span className="invisible group-hover:visible absolute right-0 bottom-full mb-1 z-10 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg">
        {t("irr.subtotal.hidden")}
      </span>
    </span>, // irr - hidden in subtotals with tooltip
    <ResponsiveFormatValue
      key="dividends"
      value={subTotals[valueIn].dividends}
    />, // summary.dividends
    <ResponsiveFormatValue
      key="unrealisedGain"
      value={subTotals[valueIn].unrealisedGain}
    />, // gain.unrealised
    <ResponsiveFormatValue
      key="realisedGain"
      value={subTotals[valueIn].realisedGain}
    />, // gain.realised
    <span
      key="weight"
      className={`font-mono tabular-nums ${
        subTotals[valueIn].weight < 0
          ? "text-red-600"
          : subTotals[valueIn].weight > 0
            ? "text-emerald-600"
            : "text-slate-600"
      }`}
    >
      <FormatValue
        value={subTotals[valueIn].weight}
        multiplier={100}
        isPublic
      />
      %
    </span>, // weight (swapped with irr)
    "-", // alpha
    <ResponsiveFormatValue
      key="totalGain"
      value={subTotals[valueIn].totalGain}
    />, // gain
  ]

  return (
    <tbody className="font-medium">
      <tr>
        <td colSpan={14} className="border-t border-blue-200"></td>
      </tr>
      <tr
        key={groupBy}
        className="holding-footer text-xs sm:text-sm bg-blue-50/60 hover:bg-blue-100/60 transition-colors duration-150"
      >
        <td className="px-1 py-1.5 sm:px-2 md:px-3 text-left font-semibold text-blue-900">
          Sub Total - {subTotals[valueIn].currency.code}
        </td>
        {data.map((item, index) => (
          <td key={index} className={getCellClasses(index)}>
            {item}
          </td>
        ))}
      </tr>
    </tbody>
  )
}
