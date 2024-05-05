import React, { ReactElement } from "react";
import { Portfolio, PortfolioSummary } from "@components/types/beancounter";
import { FormatValue } from "@components/MoneyUtils";
import { useTranslation } from "next-i18next";
import { ValueInOption } from "@components/ValueIn";

export const headers = [
  "summary.title",
  "summary.currency",
  "summary.value",
  "summary.purchases",
  "summary.sales",
  "summary.cash",
  "summary.dividends",
  "summary.gain",
];

export default function SummaryHeader(portfolio: Portfolio): ReactElement {
  const { t } = useTranslation("common");

  return (
    <tbody key={portfolio.code}>
      <tr className={"stats-header"}>
        {headers.map((header) => (
          <th
            key={header}
            align={header === "summary.title" ? "left" : "right"}
          >
            {t(header)}
          </th>
        ))}
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

  const data = [
    <div className="filter-column">
      <ValueInOption />
    </div>,
    displayCurrency,
    currencyTotals ? (
      <FormatValue value={holdingValue.marketValue} defaultValue="-" />
    ) : (
      <div>-</div>
    ),
    currencyTotals ? (
      <FormatValue value={holdingValue.purchases} defaultValue="-" />
    ) : (
      <div>-</div>
    ),
    currencyTotals ? (
      <FormatValue value={holdingValue.sales} defaultValue="-" />
    ) : (
      <div>-</div>
    ),
    currencyTotals ? (
      <FormatValue value={holdingValue.cash} defaultValue="-" />
    ) : (
      <div>-</div>
    ),
    currencyTotals ? (
      <FormatValue value={holdingValue.dividends} defaultValue="-" />
    ) : (
      <div>-</div>
    ),
    currencyTotals ? (
      <FormatValue value={holdingValue.totalGain} defaultValue="-" />
    ) : (
      <div>-</div>
    ),
  ];

  return (
    <tbody>
      <tr className={"stats-row"}>
        {data.map((item, index) => (
          <td key={index} align={index === 0 ? "left" : "right"}>
            {item}
          </td>
        ))}
      </tr>
    </tbody>
  );
}
