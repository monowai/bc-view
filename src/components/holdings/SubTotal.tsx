import React, { ReactElement } from "react"
import { GroupedSubtotals } from "types/beancounter"
import { FormatValue } from "@components/MoneyUtils"

export default function SubTotal({
  groupBy,
  subTotals,
  valueIn,
}: GroupedSubtotals): ReactElement {
  return (
    <tbody className="holding-totals-row">
      <tr>
        <td colSpan={13} className="border-t-2 border-gray-300"></td>
      </tr>
      <tr key={groupBy} className="holding-footer text-sm">
        <td colSpan={1} className="text-right px-4 py-1">
          Total - {subTotals[valueIn].currency.code}
        </td>
        <td colSpan={1} />
        <td colSpan={1} />
        <td colSpan={1} />
        <td className="text-right px-4 py-1">
          <FormatValue value={subTotals[valueIn].costValue} />
        </td>
        <td className="text-right px-4 py-1">
          <FormatValue value={subTotals[valueIn].marketValue} />
        </td>
        <td className="text-right px-4 py-1">
          <FormatValue value={subTotals[valueIn].gainOnDay} />
        </td>
        <td className="text-right px-4 py-1">
          <FormatValue value={subTotals[valueIn].unrealisedGain} />
        </td>
        <td className="text-right px-4 py-1">
          <FormatValue value={subTotals[valueIn].realisedGain} />
        </td>
        <td className="text-right px-4 py-1">
          <FormatValue value={subTotals[valueIn].dividends} />
        </td>
        <td colSpan={1} />
        <td className="text-right px-4 py-1">
          <FormatValue value={subTotals[valueIn].weight} multiplier={100} />%
        </td>
        <td className="text-right px-4 py-1">
          <FormatValue value={subTotals[valueIn].totalGain} />
        </td>
      </tr>
    </tbody>
  )
}
