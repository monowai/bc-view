import React, { ReactElement } from "react"
import { GroupedSubtotals } from "types/beancounter"
import { FormatValue, ResponsiveFormatValue } from "@components/ui/MoneyUtils"
import { headers } from "./Header"

// Helper function to generate responsive classes for table cells
const getCellClasses = (headerIndex: number): string => {
  const header = headers[headerIndex]
  let visibility
  if (header.mobile) {
    visibility = ""
  } else if (header.medium) {
    visibility = "hidden sm:table-cell" // Hidden on mobile portrait, visible on landscape (640px+)
  } else {
    visibility = "hidden xl:table-cell"
  }
  const align = header.align === "center" ? "text-center" : "text-right"
  return `px-1 py-1 md:px-2 xl:px-3 ${align} ${visibility}`
}

export default function SubTotal({
  groupBy,
  subTotals,
  valueIn,
}: GroupedSubtotals): ReactElement {
  // Define data array that matches the header structure
  const data = [
    "-", // asset.price column
    "-", // asset.change
    <span
      key="gainOnDay"
      className={`${subTotals[valueIn].gainOnDay < 0 ? "text-red-500" : subTotals[valueIn].gainOnDay > 0 ? "text-green-500" : ""}`}
    >
      <ResponsiveFormatValue value={subTotals[valueIn].gainOnDay} />
    </span>, // gain.onday - mobile visible
    "-", // quantityInc
    <FormatValue key="costValue" value={subTotals[valueIn].costValue} />, // cost
    <ResponsiveFormatValue
      key="marketValue"
      value={subTotals[valueIn].marketValue}
    />, // summary.value - mobile visible
    <FormatValue key="dividends" value={subTotals[valueIn].dividends} />, // summary.dividends
    <FormatValue
      key="unrealisedGain"
      value={subTotals[valueIn].unrealisedGain}
    />, // gain.unrealised
    <FormatValue key="realisedGain" value={subTotals[valueIn].realisedGain} />, // gain.realised
    "-", // irr
    "-", // alpha
    <span key="weight">
      <FormatValue value={subTotals[valueIn].weight} multiplier={100} />%
    </span>, // weight
    <ResponsiveFormatValue
      key="totalGain"
      value={subTotals[valueIn].totalGain}
    />, // gain - mobile visible
  ]

  return (
    <tbody className="font-medium">
      <tr>
        <td colSpan={14} className="border-t-2 border-gray-400"></td>
      </tr>
      <tr
        key={groupBy}
        className="holding-footer text-xs sm:text-sm bg-gray-50 hover:!bg-slate-200 transition-colors duration-200"
      >
        <td className="px-2 py-1 sm:px-3 text-left font-semibold">
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
