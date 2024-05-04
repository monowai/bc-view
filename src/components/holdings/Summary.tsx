import React, { ReactElement } from "react";
import { Portfolio, PortfolioSummary } from "@components/types/beancounter";
import { FormatValue } from "@components/MoneyUtils";
import { useTranslation } from "next-i18next";
import { ValueInOption } from "@components/ValueIn";

export default function SummaryHeader(portfolio: Portfolio): ReactElement {
  const { t } = useTranslation("common");
  return (
    <tbody key={portfolio.code}>
      <tr className={"stats-header"}>
        <th align={"left"}>{t("summary.title")}</th>
        <th align={"left"}>{t("summary.currency")}</th>
        <th align={"right"}>{t("summary.value")}</th>
        <th align={"right"}>{t("summary.purchases")}</th>
        <th align={"right"}>{t("summary.sales")}</th>
        <th align={"right"}>{t("summary.cash")}</th>
        <th align={"right"}>{t("summary.dividends")}</th>
        <th align={"right"}>{t("summary.gain")}</th>
      </tr>
    </tbody>
  );
}

export function SummaryRow({
  moneyValues,
  valueIn,
}: PortfolioSummary): ReactElement {
  const holdingValue = moneyValues[valueIn];
  const currencyTotals = holdingValue !== undefined;
  const displayCurrency = !currencyTotals
    ? "Mixed"
    : holdingValue.currency.code;
  return (
    <tbody>
      <tr className={"stats-row"}>
        <td>
          {/* Figure out a better way to style this component */}
          <div className="filter-column">
            <ValueInOption />
          </div>
        </td>
        <td>{displayCurrency}</td>
        <td align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdingValue.marketValue} defaultValue="-" />
          ) : (
            <div>-</div>
          )}
        </td>
        <td align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdingValue.purchases} defaultValue="-" />
          ) : (
            <div>-</div>
          )}
        </td>
        <td align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdingValue.sales} defaultValue="-" />
          ) : (
            <div>-</div>
          )}
        </td>
        <td align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdingValue.cash} defaultValue="-" />
          ) : (
            <div>-</div>
          )}
        </td>
        <td align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdingValue.dividends} defaultValue="-" />
          ) : (
            <div>-</div>
          )}
        </td>
        <td align={"right"}>
          {currencyTotals ? (
            <FormatValue value={holdingValue.totalGain} defaultValue="-" />
          ) : (
            <div>-</div>
          )}
        </td>
      </tr>
    </tbody>
  );
}
