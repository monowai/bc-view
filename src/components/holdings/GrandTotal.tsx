import { HoldingsInCurrency } from "@components/types/beancounter";
import React, { ReactElement } from "react";
import { FormatValue } from "@components/MoneyUtils";
import { useTranslation } from "next-i18next";

// Totals all subtotal values.
export default function GrandTotal({
  holdings,
  valueIn,
}: HoldingsInCurrency): ReactElement {
  const { t, ready } = useTranslation("common");
  if (!ready) return <div />;
  if (!holdings.viewTotals) return <div />;

  const data = [
    { value: holdings.viewTotals.gainOnDay, colSpan: 1 },
    { value: holdings.viewTotals.costValue, colSpan: 2 },
    { value: holdings.viewTotals.marketValue, colSpan: 1 },
    { value: holdings.viewTotals.unrealisedGain, colSpan: 1 },
    { value: holdings.viewTotals.weight, colSpan: 1 },
    { value: holdings.viewTotals.dividends, colSpan: 1 },
    { value: holdings.viewTotals.realisedGain, colSpan: 1 },
    { value: holdings.viewTotals.totalGain, colSpan: 2 },
  ];

  return (
    <tbody className={"totals-row"} key={holdings.portfolio.code + "totals"}>
      <tr key={valueIn}>
        <td colSpan={3} align={"right"}>
          <div>{t("holdings.valueTitle", { valueIn })}</div>
        </td>
        {data.map((item, index) => (
          <td key={index} colSpan={item.colSpan} align={"right"}>
            <FormatValue
              value={item.value}
              defaultValue="-"
              multiplier={index === 4 ? 100 : 1}
            />
          </td>
        ))}
      </tr>
    </tbody>
  );
}
