import React from "react";
import { Portfolio, PortfolioSummary } from "@core/types/beancounter";
import { FormatValue } from "@core/common/MoneyUtils";
import { useTranslation } from "next-i18next";
import { Portfolios } from "@core/components/Portfolios";

export default function SummaryHeader(portfolio: Portfolio): JSX.Element {
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
  portfolio,
  moneyValues,
  valueIn,
}: PortfolioSummary): JSX.Element {
  const holdingValue = moneyValues[valueIn];
  const currencyTotals = holdingValue !== undefined;
  const displayCurrency = !currencyTotals
    ? "Mixed"
    : holdingValue.currency.code;
  return (
    <tbody>
      <tr className={"stats-row"}>
        <td>
          {/* Figure out best way to style this component */}
          <div style={{ fontSize: 14 }}>
            <Portfolios {...portfolio} />
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
