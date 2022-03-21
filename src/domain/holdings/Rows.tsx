import { Asset, HoldingValues, PriceData } from "@/types/beancounter";
import NumberFormat from "react-number-format";
import { FormatValue } from "@/core/common/MoneyUtils";
import React from "react";
import { assetName, isCash } from "@/domain/assets/assetUtils";
import Link from "next/link";

export function Rows({ portfolio, holdingGroup, groupBy, valueIn }: HoldingValues): JSX.Element {
  function hideValue(asset: Asset, priceData: PriceData | undefined): boolean {
    return isCash(asset) || !priceData;
  }

  // eslint-disable-next-line complexity
  const holdings = holdingGroup.positions.map(
    ({ asset, moneyValues, quantityValues, dateValues }, index) => (
      <tr key={groupBy + index} className={"holding-row"}>
        <td className={"asset"}>{assetName(asset)}</td>
        <td className={"price"} align={"right"}>
          {
            <span
              data-tooltip={
                moneyValues[valueIn].priceData ? moneyValues[valueIn].priceData.priceDate : ""
              }
            >
              {moneyValues[valueIn].currency.id}
              {moneyValues[valueIn].currency.symbol}
              <FormatValue
                value={moneyValues[valueIn].priceData ? moneyValues[valueIn].priceData.close : " "}
              />
            </span>
          }
        </td>
        <td align={"right"}>
          {hideValue(asset, moneyValues[valueIn].priceData) ? (
            " "
          ) : (
            <span
              className={
                moneyValues[valueIn].priceData.changePercent < 0 ? "negative-gain" : "positive-gain"
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
          <FormatValue value={moneyValues[valueIn].gainOnDay} />
        </td>
        <td align={"right"}>
          <NumberFormat
            value={quantityValues.total}
            displayType={"text"}
            decimalScale={quantityValues.precision}
            fixedDecimalScale={true}
            thousandSeparator={true}
          />
          {/*)}*/}
        </td>
        <td align={"right"}>
          <Link href={`/trns/trades`} as={`/trns/trades/${portfolio.id}/${asset.id}`}>
            <a>
              <FormatValue value={moneyValues[valueIn].marketValue} defaultValue="0" />
            </a>
          </Link>
        </td>
        <td align={"right"}>
          <FormatValue value={moneyValues[valueIn].unrealisedGain} />
        </td>
        <td align={"right"}>
          <FormatValue value={moneyValues[valueIn].weight} multiplier={100} />%
        </td>
        <td align={"right"}>
          <FormatValue value={moneyValues[valueIn].costValue} />
        </td>
        <td align={"right"}>
          {hideValue(asset, moneyValues[valueIn]) ? (
            " "
          ) : (
            <FormatValue value={moneyValues[valueIn].averageCost} />
          )}
        </td>
        <td align={"right"}>
          {
            <span data-tooltip={dateValues ? `Last Event: ${dateValues.lastDividend}` : "N/A"}>
              <Link href={`/trns/events`} as={`/trns/events/${portfolio.id}/${asset.id}`}>
                <a>{<FormatValue value={moneyValues[valueIn].dividends} />}</a>
              </Link>
            </span>
          }
        </td>
        <td align={"right"}>
          <FormatValue value={moneyValues[valueIn].realisedGain} />
        </td>
        <td align={"right"}>
          <FormatValue value={moneyValues[valueIn].totalGain} />
        </td>
      </tr>
    )
  );
  return <tbody>{holdings}</tbody>;
}
