import { HoldingValues, PriceData } from "types/beancounter"
import { NumericFormat } from "react-number-format"
import { FormatValue } from "@components/MoneyUtils"
import React, { ReactElement } from "react"
import { displayName, isCashRelated } from "@utils/assets/assetUtils"
import Link from "next/link"

export default function Rows({
  portfolio,
  holdingGroup,
  groupBy,
  valueIn,
}: HoldingValues): ReactElement {
  const hideValue = (priceData: PriceData | undefined): boolean => !priceData

  return (
    <tbody>
      {holdingGroup.positions.map(
        ({ asset, moneyValues, quantityValues, dateValues }, index) => (
          <tr key={groupBy + index} className="holding-row text-sm">
            <td className="px-4 py-1 text-ellipsis">{displayName(asset)}</td>
            <td className="text-right px-4 py-1">
              {hideValue(moneyValues[valueIn].priceData) ? (
                " "
              ) : (
                <span className="relative group">
                  {moneyValues[valueIn].currency.code}
                  {moneyValues[valueIn].currency.symbol}
                  <FormatValue
                    value={moneyValues[valueIn].priceData?.close || " "}
                  />
                  <span className="absolute tooltip">
                    {moneyValues[valueIn].priceData.priceDate}
                  </span>
                </span>
              )}
            </td>
            <td className="text-right px-4 py-1">
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
                  <span className="absolute tooltip">
                    Previous {moneyValues[valueIn].currency.symbol}{" "}
                    {moneyValues[valueIn].priceData.previousClose}
                  </span>
                </span>
              )}
            </td>
            <td className="text-right px-4 py-1">
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
            <td className="text-right px-4 py-1">
              <span className="relative group">
                <FormatValue value={moneyValues[valueIn].costValue} />
                <span className="absolute tooltip pointer-events-none">
                  Average: {moneyValues[valueIn].averageCost.toLocaleString()}
                </span>
              </span>
            </td>
            <td className="text-right px-4 py-1">
              <Link
                href={`/trns/trades`}
                as={`/trns/trades/${portfolio.id}/${asset.id}`}
              >
                <FormatValue
                  value={moneyValues[valueIn].marketValue}
                  defaultValue="0"
                />
              </Link>
            </td>
            <td className="text-right px-4 py-1">
              {hideValue(moneyValues[valueIn].priceData?.changePercent) ? (
                " "
              ) : (
                <FormatValue value={moneyValues[valueIn].gainOnDay} />
              )}
            </td>
            <td className="text-right px-4 py-1">
              <FormatValue value={moneyValues[valueIn].unrealisedGain} />
            </td>
            <td className="text-right px-4 py-1">
              <FormatValue value={moneyValues[valueIn].realisedGain} />
            </td>
            <td className="text-right px-4 py-1">
              <span className="relative group">
                <Link
                  href={`/trns/events`}
                  as={`/trns/events/${portfolio.id}/${asset.id}`}
                >
                  <FormatValue value={moneyValues[valueIn].dividends} />
                </Link>
                <span className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full bg-gray-700 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 tooltip pointer-events-none">
                  Last Event: {dateValues?.lastDividend || "N/A"}
                </span>
              </span>
            </td>
            <td className="text-right px-4 py-1">
              {!isCashRelated(asset) && (
                <span className="relative group">
                  <FormatValue
                    value={moneyValues[valueIn].irr}
                    multiplier={100}
                  />
                  {"%"}
                  <span className="absolute left-1/2 transform -translate-x-1/2 -translate-y-full bg-gray-700 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 tooltip">
                    ROI: {(moneyValues[valueIn].roi * 100).toFixed(2)}%
                  </span>
                </span>
              )}
            </td>
            <td className="text-right px-4 py-1">
              <FormatValue
                value={moneyValues[valueIn].weight}
                multiplier={100}
              />
              %
            </td>
            <td className="text-right px-4 py-1">
              <FormatValue value={moneyValues[valueIn].totalGain} />
            </td>
          </tr>
        ),
      )}
    </tbody>
  )
}
