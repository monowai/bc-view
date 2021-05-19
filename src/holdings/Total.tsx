import { HoldingsInCurrency } from "../types/beancounter";
import React from "react";
import { FormatValue } from "../common/MoneyUtils";

export default function Total({ holdings, valueIn }: HoldingsInCurrency): JSX.Element {
  return (
    <tbody className={"totals-row"} key={holdings.portfolio.code + "totals"}>
      <tr key={valueIn}>
        <td colSpan={4} align={"right"}>
          Totals in {valueIn} currency
        </td>
        <td align={"right"}>
          <FormatValue value={holdings.totals[valueIn].marketValue} />
        </td>
        <td align={"right"}>
          <FormatValue value={holdings.totals[valueIn].unrealisedGain} />
        </td>
        <td />
        <td align={"right"}>
          <FormatValue value={holdings.totals[valueIn].costValue} />
        </td>
        <td />
        <td align={"right"}>
          <FormatValue value={holdings.totals[valueIn].dividends} />
        </td>
        <td align={"right"}>
          <FormatValue value={holdings.totals[valueIn].realisedGain} />
        </td>
        <td align={"right"}>
          <FormatValue value={holdings.totals[valueIn].totalGain} />
        </td>
      </tr>
    </tbody>
  );
}
