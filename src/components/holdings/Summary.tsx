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
  "summary.irr",
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
  totals,
  currency,
}: PortfolioSummary): ReactElement {
  // const total = totals[valueIn];
  const currencyTotals = totals !== undefined;
  const displayCurrency = !currencyTotals ? "Mixed" : currency.code;

  const data = [
    <div className="filter-column">
      <ValueInOption />
    </div>,
    displayCurrency,
    currencyTotals ? (
      <FormatValue value={totals.marketValue} defaultValue="-" />
    ) : (
      <div>-</div>
    ),
    currencyTotals ? (
      <FormatValue value={totals.purchases} defaultValue="-" />
    ) : (
      <div>-</div>
    ),
    currencyTotals ? (
      <FormatValue value={totals.sales} defaultValue="-" />
    ) : (
      <div>-</div>
    ),
    currencyTotals ? (
      <FormatValue value={totals.cash} defaultValue="-" />
    ) : (
      <div>-</div>
    ),
    currencyTotals ? (
      <FormatValue value={totals.income} defaultValue="-" />
    ) : (
      <div>-</div>
    ),
    currencyTotals ? (
      <>
        <FormatValue
          value={totals.irr}
          defaultValue="-"
          multiplier={100}
          scale={2}
        />
        {"%"}
      </>
    ) : (
      <div>-</div>
    ),

    currencyTotals ? (
      <FormatValue value={totals.gain} defaultValue="-" />
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
