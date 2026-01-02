import React, { ReactElement } from "react"
import { GroupedSubtotals } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { headers } from "./Header"
import { useTranslation } from "next-i18next"

interface SubTotalProps extends GroupedSubtotals {
  positionCount: number
  showWeightedIrr?: boolean
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
  const padding = "px-0.5 py-1 sm:px-1 md:px-2 xl:px-3"

  return `${padding} ${align} ${visibility}`
}

export default function SubTotal({
  groupBy,
  subTotals,
  valueIn,
  positionCount,
  showWeightedIrr = false,
}: SubTotalProps): ReactElement | null {
  const { t } = useTranslation("common")

  // Skip subtotal when there's only 1 position - it would duplicate the row values
  if (positionCount <= 1) {
    return null
  }
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

  // Weighted IRR element with tooltip
  const weightedIrr = subTotals[valueIn].weightedIrr
  const irrElement = showWeightedIrr ? (
    <span key="weightedIrr" className="group relative cursor-help">
      <FormatValue value={weightedIrr} multiplier={100} />%
      <span className="invisible group-hover:visible absolute right-0 bottom-full mb-1 z-10 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
        {t("irr.weighted.tooltip")}
      </span>
    </span>
  ) : (
    "-"
  )

  const data = [
    "-", // asset.price column
    gainOnDayElement, // asset.change - shows gainOnDay sum on mobile
    gainOnDayElement, // gain.onday (hidden)
    "-", // quantity
    <FormatValue key="costValue" value={subTotals[valueIn].costValue} />, // cost
    <FormatValue key="marketValue" value={subTotals[valueIn].marketValue} />, // summary.value
    irrElement, // weighted irr (swapped with weight)
    <FormatValue key="dividends" value={subTotals[valueIn].dividends} />, // summary.dividends
    <FormatValue
      key="unrealisedGain"
      value={subTotals[valueIn].unrealisedGain}
    />, // gain.unrealised
    <FormatValue key="realisedGain" value={subTotals[valueIn].realisedGain} />, // gain.realised
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
    </span>, // weight (swapped with irr)
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
