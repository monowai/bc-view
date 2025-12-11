import React, { ReactElement } from "react"
import { GroupedSubtotals } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { headers } from "./Header"

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
  const padding = "px-0.5 py-1 sm:px-1 md:px-2 xl:px-3"

  return `${padding} ${align} ${visibility}`
}

export default function SubTotal({
  groupBy,
  subTotals,
  valueIn,
}: GroupedSubtotals): ReactElement {
  // Define data array that matches the header structure
  const gainOnDay = subTotals[valueIn].gainOnDay
  const gainOnDayElement = (
    <span
      key="gainOnDay"
      className={`${gainOnDay < 0 ? "text-red-500" : gainOnDay > 0 ? "text-green-500" : ""}`}
    >
      <FormatValue value={gainOnDay} />
    </span>
  )
  const data = [
    "-", // asset.price column
    gainOnDayElement, // asset.change - shows gainOnDay sum on mobile
    gainOnDayElement, // gain.onday (hidden)
    "-", // quantity
    <FormatValue key="costValue" value={subTotals[valueIn].costValue} />, // cost
    <FormatValue key="marketValue" value={subTotals[valueIn].marketValue} />, // summary.value
    <span
      key="weight"
      className={`${
        subTotals[valueIn].weight < 0
          ? "text-red-500"
          : subTotals[valueIn].weight > 0
            ? "text-green-500"
            : ""
      }`}
    >
      <FormatValue value={subTotals[valueIn].weight} multiplier={100} />%
    </span>, // weight (moved between value and income)
    <FormatValue key="dividends" value={subTotals[valueIn].dividends} />, // summary.dividends
    <FormatValue
      key="unrealisedGain"
      value={subTotals[valueIn].unrealisedGain}
    />, // gain.unrealised
    <FormatValue key="realisedGain" value={subTotals[valueIn].realisedGain} />, // gain.realised
    "-", // irr - cannot be summed, requires cash flow calculation
    "-", // alpha
    <FormatValue key="totalGain" value={subTotals[valueIn].totalGain} />, // gain
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
