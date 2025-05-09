import { HoldingsInCurrency } from "types/beancounter"
import React, { ReactElement } from "react"
import { FormatValue } from "@components/MoneyUtils"
import { useTranslation } from "next-i18next"

// Totals all subtotal values.
export default function GrandTotal({
  holdings,
  valueIn,
}: HoldingsInCurrency): ReactElement {
  const { t, ready } = useTranslation("common")
  if (!ready) return <div />
  if (!holdings.viewTotals) return <div />

  const data = [
    { value: holdings.viewTotals.costValue, colSpan: 2 },
    { value: holdings.viewTotals.marketValue, colSpan: 1 },
    { value: holdings.viewTotals.gainOnDay, colSpan: 1 },
    { value: holdings.viewTotals.unrealisedGain, colSpan: 1 },
    { value: holdings.viewTotals.realisedGain, colSpan: 1 },
    { value: holdings.viewTotals.dividends, colSpan: 1 },
    { value: holdings.viewTotals.irr, colSpan: 1, multiplier: 100 },
    { value: holdings.viewTotals.weight, colSpan: 1, multiplier: 100 },
    { value: holdings.viewTotals.totalGain, colSpan: 1 },
  ]

  return (
    <tbody className="grand-totals" key={holdings.portfolio.code + "totals"}>
      <tr key={valueIn} className="holding-footer text-sm">
        <td colSpan={1} className="text-right px-4 py-1">
          <div>{t("holdings.valueTitle", { valueIn })}</div>
        </td>
        <td colSpan={2} />
        {data.map((item, index) => (
          <td
            key={index}
            colSpan={item.colSpan}
            className="text-right px-4 py-1"
          >
            <FormatValue
              value={item.value}
              defaultValue="-"
              multiplier={index === 7 ? 100 : 1}
            />
            {index === 7 && "%"}
          </td>
        ))}
      </tr>
    </tbody>
  )
}
