import { HoldingsInCurrency } from "../types/beancounter";
import React from "react";
import { FormatValue } from "../common/MoneyUtils";

export default function Total({ holdings, valueIn }: HoldingsInCurrency): JSX.Element {
  const currencyTotals = holdings.totals[valueIn] !== undefined;
  return (
    <tbody className={"totals-row"} key={holdings.portfolio.code + "totals"}>
      <tr key={valueIn}>
        <td colSpan={4} align={"right"}>
          {currencyTotals ? (
            <div>Totals in {valueIn} currency</div>
          ) : (
            <div>Mixed Trade Currencies</div>
          )}
        </td>
        <td align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdings.totals[valueIn].marketValue} />
          ) : (
            <div>-</div>
          )}
        </td>
        <td align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdings.totals[valueIn].unrealisedGain} />
          ) : (
            <div>-</div>
          )}
        </td>
        <td />
        <td align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdings.totals[valueIn].costValue} />
          ) : (
            <div>-</div>
          )}
        </td>
        <td />
        <td align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdings.totals[valueIn].dividends} />
          ) : (
            <div>-</div>
          )}
        </td>
        <td align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdings.totals[valueIn].realisedGain} />
          ) : (
            <div>-</div>
          )}
        </td>
        <td align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdings.totals[valueIn].totalGain} />
          ) : (
            <div>-</div>
          )}
        </td>
      </tr>
    </tbody>
  );
}
