import React, { ReactElement, useCallback } from "react"
import { Portfolio, PortfolioSummary } from "types/beancounter"
import { FormatValue } from "@components/MoneyUtils"
import { useTranslation } from "next-i18next"
import { Controller, useForm } from "react-hook-form"
import { useHoldingState } from "@utils/holdings/holdingState"
import { getTodayDate } from "@components/dateutils"
import Link from "next/link"

export const headers = [
  { key: "summary.currency", align: "right" as const },
  { key: "summary.value", align: "right" as const },
  { key: "summary.purchases", align: "right" as const },
  { key: "summary.sales", align: "right" as const },
  { key: "summary.cash", align: "right" as const },
  { key: "summary.dividends", align: "right" as const },
  { key: "summary.irr", align: "right" as const },
  { key: "summary.gain", align: "right" as const },
]

export default function SummaryHeader(portfolio: Portfolio): ReactElement {
  const { t } = useTranslation("common")
  const { control, handleSubmit } = useForm()
  const holdingState = useHoldingState()

  const onSubmit = useCallback(
    (data: any): void => {
      holdingState.setAsAt(data.date)
    },
    [holdingState],
  )

  const handleDateChange = useCallback(
    (field: any) => (event: React.ChangeEvent<HTMLInputElement>) => {
      field.onChange(event)
      const date = new Date(event.target.value)
      if (!isNaN(date.getTime())) {
        handleSubmit(onSubmit)()
      }
    },
    [handleSubmit, onSubmit],
  )

  return (
    <thead>
      <tr className="bg-gray-200">
        <th className="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm">
          <div className="flex justify-between">
            <span className="text-right">
              {portfolio.name}
              <Link
                href={`/portfolios/${portfolio.id}`}
                className="far fa-edit text-gray-500 hover:text-gray-700 ml-2"
              />
              <div className="mt-1 flex items-center"></div>
            </span>
            <span className="text-left">
              <form onSubmit={handleSubmit(onSubmit)}>
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="date"
                      defaultValue={getTodayDate(holdingState.asAt)}
                      className="input"
                      onChange={handleDateChange(field)}
                    />
                  )}
                />
              </form>
            </span>
          </div>
        </th>
        {headers.map((header) => (
          <th
            key={header.key}
            align={header.align}
            className="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm"
          >
            {t(header.key)}
          </th>
        ))}
      </tr>
    </thead>
  )
}

export function SummaryRow({
  totals,
  currency,
}: PortfolioSummary): ReactElement {
  const currencyTotals = totals !== undefined
  const displayCurrency = !currencyTotals ? "Mixed" : currency.code

  const data = [
    undefined,
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
  ]

  return (
    <tbody>
      <tr className="bg-white">
        {data.map((item, index) => (
          <td
            key={index}
            align="right"
            className="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm"
          >
            {item}
          </td>
        ))}
      </tr>
    </tbody>
  )
}
