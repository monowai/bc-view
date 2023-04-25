import React from "react";
import { GroupedSubtotals } from "@/types/beancounter";
import { FormatValue } from "@/core/common/MoneyUtils";

export function SubTotal({
  groupBy,
  subTotals,
  valueIn,
}: GroupedSubtotals): JSX.Element {
  return (
    <tbody className={"holding-totals-row"}>
      <tr key={groupBy} className={"holding-footer"}>
        <td colSpan={3} align={"right"}>
          Sub-Total - {subTotals[valueIn].currency.code}
        </td>
        <td align={"right"}>
          <FormatValue value={subTotals[valueIn].gainOnDay} />
        </td>
        <td colSpan={2} align={"right"}>
          <FormatValue value={subTotals[valueIn].costValue} />
        </td>
        <td colSpan={2} align={"right"}>
          <FormatValue value={subTotals[valueIn].marketValue} />
        </td>
        <td colSpan={1} align={"right"}>
          <FormatValue value={subTotals[valueIn].unrealisedGain} />
        </td>
        <td />
        <td align={"right"}>
          <FormatValue value={subTotals[valueIn].dividends} />
        </td>
        <td align={"right"}>
          <FormatValue value={subTotals[valueIn].realisedGain} />
        </td>
        <td align={"right"}>
          <FormatValue value={subTotals[valueIn].totalGain} />
        </td>
      </tr>
    </tbody>
  );
}
