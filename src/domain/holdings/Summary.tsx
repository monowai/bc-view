import React from "react";
import "../../core/css/styles.sass";
import { Portfolio, PortfolioSummary } from "../../core/types/beancounter";
import { FormatValue } from "../../core/common/MoneyUtils";
import { Link } from "react-router-dom";
import { translate } from "../../core/common/i18nUtils";

export default function SummaryHeader(portfolio: Portfolio): JSX.Element {
  return (
    <tbody key={portfolio.code}>
      <tr className={"stats-header"}>
        <th align={"left"}>Summary</th>
        <th align={"right"}>{translate("summary.value")}</th>
        <th align={"right"}>{translate("summary.purchases")}</th>
        <th align={"right"}>{translate("summary.sales")}</th>
        <th align={"right"}>{translate("summary.cash")}</th>
        <th align={"right"}>{translate("summary.dividends")}</th>
        <th align={"right"}>{translate("summary.gain")}</th>
      </tr>
    </tbody>
  );
}

export function SummaryRow({ portfolio, moneyValues, valueIn }: PortfolioSummary): JSX.Element {
  const holdingValue = moneyValues[valueIn];
  const currencyTotals = holdingValue !== undefined;
  return (
    <tbody>
      <tr className={"stats-row"}>
        <td>
          <div className="left-cell">
            <Link to={`/portfolios/${portfolio.id}`}>
              <span className={"has-tooltip-right"} data-tooltip={portfolio.name}>
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
