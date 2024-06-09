import React, { ReactElement } from "react";
import { GroupedSubtotals } from "@components/types/beancounter";
import { FormatValue } from "@components/MoneyUtils";

export default function SubTotal({
  groupBy,
  subTotals,
  valueIn,
}: GroupedSubtotals): ReactElement {
  return (
    <tbody className={"holding-totals-row"}>
      <tr key={groupBy} className={"holding-footer"}>
        <td colSpan={3} align={"right"}>
          Total - {subTotals[valueIn].currency.code}
        </td>
        <td colSpan={2} align={"right"}>
          <FormatValue value={subTotals[valueIn].costValue} />
        </td>
        <td colSpan={1} align={"right"}>
          <FormatValue value={subTotals[valueIn].marketValue} />
        </td>
        <td align={"right"}>
          <FormatValue value={subTotals[valueIn].gainOnDay} />
        </td>
        <td colSpan={1} align={"right"}>
          <FormatValue value={subTotals[valueIn].unrealisedGain} />
        </td>
        <td align={"right"}>
          <FormatValue value={subTotals[valueIn].realisedGain} />
        </td>
        <td align={"right"}>
          <FormatValue value={subTotals[valueIn].dividends} />
        </td>
        <td />
        <td align={"right"}>
          <FormatValue value={subTotals[valueIn].weight} multiplier={100} />%
        </td>
        <td align={"right"}>
          <FormatValue value={subTotals[valueIn].totalGain} />
        </td>
      </tr>
    </tbody>
  );
}
