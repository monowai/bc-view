import { HoldingValues } from "../types/beancounter";
import NumberFormat from "react-number-format";
import { Link } from "react-router-dom";
import { FormatValue } from "../common/MoneyUtils";
import React from "react";

export function Rows({ portfolio, holdingGroup, groupBy, valueIn }: HoldingValues): JSX.Element {
  // eslint-disable-next-line complexity
  const holdings = holdingGroup.positions.map(
    ({ asset, moneyValues, quantityValues, dateValues }, index) => (
      <tr key={groupBy + index} className={"holding-row"}>
        <td className={"asset"}>{asset.code + ": " + asset.name}</td>
        <td className={"price"} align={"right"}>
          {
            <span
              data-tooltip={
                moneyValues[valueIn].priceData ? moneyValues[valueIn].priceData.priceDate : ""
              }
            >
              {moneyValues[valueIn].currency.id}
              {moneyValues[valueIn].currency.symbol}
              <FormatValue value={moneyValues[valueIn].priceData.close} />
            </span>
          }
        </td>
        <td align={"right"}>
          {!moneyValues[valueIn].priceData ? (
            "-"
          ) : (
            <span
              className={
                moneyValues[valueIn].priceData.changePercent < 0 ? "negative-gain" : "positive-gain"
              }
              data-tooltip={
                "Previous " +
                moneyValues[valueIn].currency.symbol +
                " " +
                moneyValues[valueIn].priceData.previousClose
              }
            >
              {(moneyValues[valueIn].priceData.changePercent * 100).toFixed(2)}%
            </span>
          )}
        </td>
        <td align={"right"}>
          <Link to={`/trns/${portfolio.id}/asset/${asset.id}/trades`}>
            <NumberFormat
              value={quantityValues.total}
              displayType={"text"}
              decimalScale={quantityValues.precision}
              fixedDecimalScale={true}
              thousandSeparator={true}
            />
          </Link>
        </td>
        <td align={"right"}>
          <FormatValue value={moneyValues[valueIn].marketValue} />
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
          <FormatValue value={moneyValues[valueIn].averageCost} />
        </td>
        <td align={"right"}>
          {
            <span data-tooltip={dateValues ? "Last Event: " + dateValues.lastDividend : "N/A"}>
              <Link to={`/trns/${portfolio.id}/asset/${asset.id}/events`}>
                <FormatValue value={moneyValues[valueIn].dividends} />
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
