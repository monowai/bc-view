import React from "react";
import { Portfolio, PortfolioSummary } from "@/types/beancounter";
import { FormatValue } from "@/core/common/MoneyUtils";
import Link from "next/link";
import { useTranslation } from "next-i18next";

export default function SummaryHeader(portfolio: Portfolio): JSX.Element {
  const { t } = useTranslation("common");
  return (
    <tbody key={portfolio.code}>
      <tr className={"stats-header"}>
        <th align={"left"}>{t("summary.title")}</th>
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
  return (
    <tbody>
      <tr className={"stats-row"}>
        <td>
          <div className="left-cell">
            <Link href={`/portfolios/${portfolio.id}`} passHref>
              <span
                className={"has-tooltip-right"}
                data-tooltip={portfolio.name}
              >
                {portfolio.code.toUpperCase()} {": "}
              </span>
            </Link>
            {!currencyTotals ? "Mixed" : holdingValue.currency.code}
          </div>
        </td>
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
