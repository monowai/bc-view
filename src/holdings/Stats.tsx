import React from "react";
import "../css/styles.sass";
import { Portfolio, PortfolioSummary } from "../types/beancounter";
import { FormatValue } from "../common/MoneyUtils";
import { ValueIn } from "../types/valueBy";
import { Link } from "react-router-dom";
import { translate } from "../common/i18nUtils";

export default function StatsHeader(portfolio: Portfolio): JSX.Element {
  return (
    <tbody key={portfolio.code}>
      <tr className={"stats-header"}>
        <th align={"left"}>Summary</th>
        <th align={"right"}>{translate("value")}</th>
        <th align={"right"}>{translate("purchases")}</th>
        <th align={"right"}>{translate("sales")}</th>
        <th align={"right"}>{translate("dividends")}</th>
        <th align={"right"}>{translate("strategy")}</th>
      </tr>
    </tbody>
  );
}

export function StatsRow({ portfolio, moneyValues, valueIn }: PortfolioSummary): JSX.Element {
  const holdingValue = moneyValues[valueIn];
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
            {!holdingValue || holdingValue.valueIn === ValueIn.TRADE
              ? "N/A"
              : holdingValue.currency.code}
          </div>
        </td>
        <td align={"right"}>
          <FormatValue value={holdingValue.marketValue} />
        </td>
        <td align={"right"}>
          <FormatValue value={holdingValue.purchases} />
        </td>
        <td align={"right"}>
          <FormatValue value={holdingValue.sales} />
        </td>
        <td align={"right"}>
          <FormatValue value={holdingValue.dividends} />
        </td>
        <td align={"right"}>
          <FormatValue value={holdingValue.totalGain} />
        </td>
      </tr>
    </tbody>
  );
}
