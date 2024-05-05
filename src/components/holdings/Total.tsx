import { HoldingsInCurrency } from "@components/types/beancounter";
import React, { ReactElement } from "react";
import { FormatValue } from "@components/MoneyUtils";
import { useTranslation } from "next-i18next";

export default function Total({
  holdings,
  valueIn,
}: HoldingsInCurrency): ReactElement {
  const { t, ready } = useTranslation("common");
  if (!ready) return <div />;
  if (!holdings.totals[valueIn]) return <div />;

  const currencyTotals = holdings.totals[valueIn] !== undefined;

  const data = [
    { value: holdings.totals[valueIn].gainOnDay, colSpan: 1 },
    { value: holdings.totals[valueIn].costValue, colSpan: 2 },
    { value: holdings.totals[valueIn].marketValue, colSpan: 2 },
    { value: holdings.totals[valueIn].unrealisedGain, colSpan: 1 },
    { value: null, colSpan: 1 },
    { value: holdings.totals[valueIn].dividends, colSpan: 1 },
    { value: holdings.totals[valueIn].realisedGain, colSpan: 1 },
    { value: holdings.totals[valueIn].totalGain, colSpan: 1 },
  ];

  return (
    <tbody className={"totals-row"} key={holdings.portfolio.code + "totals"}>
      <tr key={valueIn}>
        <td colSpan={3} align={"right"}>
          {currencyTotals ? (
            <div>{t("holdings.valuein", { valueIn })}</div>
          ) : (
            <div>{t("holdings.mixed")}</div>
          )}
        </td>
        {data.map((item, index) => (
          <td key={index} colSpan={item.colSpan} align={"right"}>
            {currencyTotals ? (
              <FormatValue value={item.value} defaultValue="-" />
            ) : (
              <div>-</div>
            )}
          </td>
        ))}
      </tr>
    </tbody>
  );
}
