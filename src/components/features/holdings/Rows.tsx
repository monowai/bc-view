import React, { useEffect, useMemo } from "react"
import { HoldingValues, PriceData } from "types/beancounter"
import { NumericFormat } from "react-number-format"
import { FormatValue } from "@components/ui/MoneyUtils"
import { isCashRelated, isCash } from "@lib/assets/assetUtils"
import { headers } from "./Header"
import Link from "next/link"
import { WeightProgress } from "@components/ui/ProgressBar"

interface RowsProps extends HoldingValues {
  onColumnsChange: (columns: string[]) => void
}

// Helper function to generate responsive classes for table cells
const getCellClasses = (headerIndex: number): string => {
  const header = headers[headerIndex]
  let visibility
  if (header.mobile) {
    visibility = ""
  } else if (header.medium) {
    visibility = "hidden md:table-cell"
  } else {
    visibility = "hidden xl:table-cell"
  }
  return `text-right px-1 py-1 md:px-2 xl:px-4 ${visibility}`
}

// Helper function to truncate text with ellipsis
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + "..."
}

export default function Rows({
  portfolio,
  holdingGroup,
  groupBy,
  valueIn,
  onColumnsChange,
}: RowsProps): React.ReactElement {
  const columns = useMemo(
    () => [
      "Asset Code",
      "Asset Name",
      "Price",
      "Change %",
      "Change on Day",
      "Quantity",
      "Cost Value",
      "Market Value",
      "Unrealised Gain",
      "Realised Gain",
      "Dividends",
      "IRR",
      "Weight",
      "Total Gain",
    ],
    [],
  )

  useEffect(() => {
    onColumnsChange(columns)
  }, [columns, onColumnsChange])

  const hideValue = (priceData: PriceData | undefined): boolean => !priceData

  return (
    <tbody>
      {holdingGroup.positions.map(
        ({ asset, moneyValues, quantityValues, dateValues }, index) => (
          <tr
            key={groupBy + index}
            className="holding-row text-xs sm:text-sm bg-white hover:!bg-slate-200 transition-colors duration-200 cursor-pointer"
          >
            <td className="px-2 py-1 sm:px-4 text-ellipsis min-w-0">
              {/* Unified layout: code on top, name below for both mobile and desktop */}
              <div>
                <div
                  className="font-semibold text-sm sm:text-base"
                  title={asset.code}
                >
                  {isCash(asset)
                    ? asset.name
                    : asset.code.indexOf(".") > 0
                      ? asset.code.substring(asset.code.indexOf(".") + 1)
                      : asset.code}
                </div>
                {!isCash(asset) && (
                  <div
                    className="text-xs sm:text-sm text-gray-600"
                    title={asset.name}
                  >
                    {truncateText(asset.name, 30)}
                  </div>
                )}
              </div>
            </td>
            <td className={getCellClasses(0)}>
              {hideValue(moneyValues[valueIn].priceData) ? (
                " "
              ) : (
                <span className="relative group">
                  <span className="text-xs text-gray-500">
                    {moneyValues[valueIn].currency.symbol}
                  </span>
                  <FormatValue
                    value={moneyValues[valueIn].priceData?.close || " "}
                  />
                  <span className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full mb-1 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
                    {moneyValues[valueIn].priceData.priceDate}
                  </span>
                </span>
              )}
            </td>
            <td className="text-right px-1 py-1 md:px-2 xl:px-4 hidden xl:table-cell">
              {hideValue(moneyValues[valueIn].priceData?.changePercent) ? (
                " "
              ) : (
                <span
                  className={`relative group ${
                    moneyValues[valueIn].priceData.changePercent < 0
                      ? "text-red-500"
                      : "text-green-500"
                  }`}
                >
                  {(moneyValues[valueIn].priceData.changePercent * 100).toFixed(
                    2,
                  )}
                  %
                  <span className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full mb-1 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
                    Previous {moneyValues[valueIn].currency.symbol}{" "}
                    {moneyValues[valueIn].priceData.previousClose}
                  </span>
                </span>
              )}
            </td>
            <td className="text-right px-1 py-1 md:px-2 xl:px-4 hidden xl:table-cell">
              {hideValue(moneyValues[valueIn].priceData) ? (
                " "
              ) : (
                <FormatValue value={moneyValues[valueIn].gainOnDay} />
              )}
            </td>

            <td className={getCellClasses(3)}>
              {isCashRelated(asset) ||
              hideValue(moneyValues[valueIn].priceData) ? (
                " "
              ) : (
                <NumericFormat
                  value={quantityValues.total}
                  displayType="text"
                  decimalScale={quantityValues.precision}
                  fixedDecimalScale
                  thousandSeparator
                />
              )}
            </td>
            <td className={getCellClasses(4)}>
              <span className="relative group">
                <FormatValue value={moneyValues[valueIn].costValue} />
                <span className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full mb-1 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
                  Average: {moneyValues[valueIn].averageCost.toLocaleString()}
                </span>
              </span>
            </td>
            <td className={getCellClasses(5)}>
              <Link
                href={`/trns/trades`}
                as={`/trns/trades/${portfolio.id}/${asset.id}`}
                className="text-blue-600 hover:text-blue-800"
              >
                <FormatValue
                  value={moneyValues[valueIn].marketValue}
                  defaultValue="0"
                />
              </Link>
            </td>
            <td className="text-right px-1 py-1 md:px-2 xl:px-4 hidden xl:table-cell">
              <span className="relative group">
                <Link
                  href={`/trns/events`}
                  as={`/trns/events/${portfolio.id}/${asset.id}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <FormatValue value={moneyValues[valueIn].dividends} />
                </Link>
                <span className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full mb-1 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
                  Last Event: {dateValues?.lastDividend || "N/A"}
                </span>
              </span>
            </td>
            <td className={getCellClasses(7)}>
              <FormatValue value={moneyValues[valueIn].unrealisedGain} />
            </td>
            <td className="text-right px-1 py-1 md:px-2 xl:px-4 hidden xl:table-cell">
              <FormatValue value={moneyValues[valueIn].realisedGain} />
            </td>
            <td className="text-right px-1 py-1 md:px-2 xl:px-4 hidden xl:table-cell">
              {!isCashRelated(asset) && (
                <span className="relative group">
                  <FormatValue
                    value={moneyValues[valueIn].irr}
                    multiplier={100}
                  />
                  {"%"}
                  <span className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full mb-1 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
                    ROI: {(moneyValues[valueIn].roi * 100).toFixed(2)}%
                  </span>
                </span>
              )}
            </td>
            <td className="text-right px-1 py-1 md:px-2 xl:px-4 hidden xl:table-cell">
              <WeightProgress
                weight={moneyValues[valueIn].weight}
                className="min-w-[120px]"
              />
            </td>
            <td className={getCellClasses(11)}>
              <FormatValue value={moneyValues[valueIn].totalGain} />
            </td>
          </tr>
        ),
      )}
    </tbody>
  )
}
