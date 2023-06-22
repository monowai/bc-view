import { HoldingsInCurrency } from "@core/types/beancounter";
import React, {ReactElement} from "react";
import { FormatValue } from "@core/common/MoneyUtils";
import { useTranslation } from "next-i18next";

export default function Total({
  holdings,
  valueIn,
}: HoldingsInCurrency): ReactElement {
  const { t, ready } = useTranslation("common");
  if (!ready) return <div />;
  if (!holdings.totals[valueIn]) return <div />;

  const currencyTotals = holdings.totals[valueIn] !== undefined;
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
        <td colSpan={1} align={"right"}>
          <FormatValue value={holdings.totals[valueIn].gainOnDay} />
        </td>
        <td colSpan={2} align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdings.totals[valueIn].costValue} />
          ) : (
            <div>-</div>
          )}
        </td>
        <td colSpan={2} align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdings.totals[valueIn].marketValue} />
          ) : (
            <div>-</div>
          )}
        </td>
        <td colSpan={1} align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdings.totals[valueIn].unrealisedGain} />
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
