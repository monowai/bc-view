import { HoldingValues, PriceData } from "@components/types/beancounter";
import { NumericFormat } from "react-number-format";
import { FormatValue } from "@components/MoneyUtils";
import React, { ReactElement } from "react";
import { displayName, isCashRelated } from "@utils/assets/assetUtils";
import Link from "next/link";

export default function Rows({
  portfolio,
  holdingGroup,
  groupBy,
  valueIn,
}: HoldingValues): ReactElement {
  function hideValue(priceData: PriceData | undefined): boolean {
    return !priceData;
  }

  // eslint-disable-next-line complexity
  const holdings = holdingGroup.positions.map(
    ({ asset, moneyValues, quantityValues, dateValues }, index) => (
      <tr key={groupBy + index} className={"holding-row"}>
        <td className={"asset"}>{displayName(asset)}</td>
        <td className={"price"} align={"right"}>
          {hideValue(moneyValues[valueIn].priceData) ? (
            " "
          ) : (
            <span
              data-tooltip={
                moneyValues[valueIn].priceData
                  ? moneyValues[valueIn].priceData.priceDate
                  : ""
              }
            >
              {moneyValues[valueIn].currency.code}
              {moneyValues[valueIn].currency.symbol}
              <FormatValue
                value={
                  moneyValues[valueIn].priceData
                    ? moneyValues[valueIn].priceData.close
                    : " "
                }
              />
            </span>
          )}
        </td>
        <td align={"right"}>
          {hideValue(
            moneyValues[valueIn].priceData &&
              moneyValues[valueIn].priceData.changePercent,
          ) ? (
            " "
          ) : (
            <span
              className={
                moneyValues[valueIn].priceData.changePercent < 0
                  ? "negative-gain"
                  : "positive-gain"
              }
              data-tooltip={
                `Previous ${moneyValues[valueIn].currency.symbol}` +
                " " +
                moneyValues[valueIn].priceData.previousClose
              }
            >
              {(moneyValues[valueIn].priceData.changePercent * 100).toFixed(2)}%
            </span>
          )}
        </td>
        <td align={"right"}>
          {hideValue(moneyValues[valueIn].priceData) ||
          !moneyValues[valueIn].priceData.changePercent ? (
            " "
          ) : (
            <FormatValue value={moneyValues[valueIn].gainOnDay} />
          )}
        </td>
        <td align={"right"}>
          {isCashRelated(asset) || hideValue(moneyValues[valueIn].priceData) ? (
            " "
          ) : (
            <NumericFormat
              value={quantityValues.total}
              displayType={"text"}
              decimalScale={quantityValues.precision}
              fixedDecimalScale={true}
              thousandSeparator={true}
            />
          )}
          {/*)}*/}
        </td>
        <td align={"right"}>
          <span
            data-tooltip={`Average: ${moneyValues[valueIn].averageCost.toLocaleString()}`}
          >
            <FormatValue value={moneyValues[valueIn].costValue} />
          </span>
        </td>
        <td align={"right"}>
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
        <td align={"right"}>
          <FormatValue value={moneyValues[valueIn].unrealisedGain} />
        </td>
        <td align={"right"}>
          <FormatValue value={moneyValues[valueIn].weight} multiplier={100} />%
        </td>
        <td align={"right"}>
          {
            <span
              data-tooltip={
                dateValues ? `Last Event: ${dateValues.lastDividend}` : "N/A"
              }
            >
              <Link
                href={`/trns/events`}
                as={`/trns/events/${portfolio.id}/${asset.id}`}
              >
                {<FormatValue value={moneyValues[valueIn].dividends} />}
              </Link>
            </span>
          }
        </td>
        <td align={"right"}>
          <FormatValue value={moneyValues[valueIn].realisedGain} />
        </td>

        <td align={"right"}>
          {!isCashRelated(asset) && (
            <>
              <span
                data-tooltip={`ROI: ${(moneyValues[valueIn].roi * 100).toFixed(2)}%`}
              >
                <FormatValue
                  value={moneyValues[valueIn].irr}
                  multiplier={100}
                />
                {"%"}
              </span>
            </>
          )}
        </td>

        <td align={"right"}>
          <FormatValue value={moneyValues[valueIn].totalGain} />
        </td>
      </tr>
    ),
  );
  return <tbody>{holdings}</tbody>;
}
