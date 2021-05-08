import React from "react";
import { GroupedSubtotals } from "../types/beancounter";
import { FormatValue } from "../common/MoneyUtils";

export function SubTotal({ groupBy, subTotals, valueIn }: GroupedSubtotals): JSX.Element {
  return (
    <tbody className={"holding-totals-row"}>
    <tr key={groupBy} className={"holding-footer"}>
      <td colSpan={4} align={"right"}>
        Sub-Total - {subTotals[valueIn].currency.code}
      </td>
      <td align={"right"}>
        <FormatValue value={subTotals[valueIn].marketValue}/>
      </td>
      <td align={"right"}>
        <FormatValue value={subTotals[valueIn].unrealisedGain}/>
      </td>
      <td/>
      <td align={"right"}>
        <FormatValue value={subTotals[valueIn].costValue}/>
      </td>
      <td/>
      <td align={"right"}>
        <FormatValue value={subTotals[valueIn].dividends}/>
      </td>
      <td align={"right"}>
        <FormatValue value={subTotals[valueIn].realisedGain}/>
      </td>
      <td align={"right"}>
        <FormatValue value={subTotals[valueIn].totalGain}/>
      </td>
    </tr>
    </tbody>
  );
}
