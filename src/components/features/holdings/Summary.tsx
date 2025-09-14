import React, { ReactElement, useCallback } from "react"
import { Portfolio, PortfolioSummary } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { useTranslation } from "next-i18next"
import { Controller, useForm } from "react-hook-form"
import { useHoldingState } from "@lib/holdings/holdingState"
import Link from "next/link"
import { getTodayDate } from "@lib/dateUtils"

export const headers = [
  {
    key: "summary.currency",
    align: "right" as const,
    mobile: true,
    medium: true,
  },
  { key: "summary.value", align: "right" as const, mobile: true, medium: true },
  {
    key: "summary.purchases",
    align: "right" as const,
    mobile: false,
    medium: true,
  },
  {
    key: "summary.sales",
    align: "right" as const,
    mobile: false,
    medium: true,
  },
  {
    key: "summary.cash",
    align: "right" as const,
    mobile: false,
    medium: false,
  },
  {
    key: "summary.dividends",
    align: "right" as const,
    mobile: false,
    medium: false,
  },
  { key: "summary.irr", align: "right" as const, mobile: true, medium: true },
  { key: "summary.gain", align: "right" as const, mobile: true, medium: true },
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
        {headers.map((header) => {
          let visibility
          if (header.mobile) {
            visibility = ""
          } else if (header.medium) {
            visibility = "hidden md:table-cell"
          } else {
            visibility = "hidden xl:table-cell"
          }

          return (
            <th
              key={header.key}
              align={header.align}
              className={`px-1 py-2 md:px-2 xl:px-4 text-xs md:text-sm font-medium text-${header.align} ${visibility}`}
            >
              {t(header.key)}
            </th>
          )
        })}
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

  // Data array that matches the headers structure exactly
  const dataWithVisibility = [
    { content: displayCurrency, mobile: true, medium: true }, // summary.currency
    {
      content: currencyTotals ? (
        <FormatValue value={totals.marketValue} defaultValue="-" />
      ) : (
        <div>-</div>
      ),
      mobile: true,
      medium: true,
    }, // summary.value
    {
      content: currencyTotals ? (
        <FormatValue value={totals.purchases} defaultValue="-" />
      ) : (
        <div>-</div>
      ),
      mobile: false,
      medium: true,
    }, // summary.purchases
    {
      content: currencyTotals ? (
        <FormatValue value={totals.sales} defaultValue="-" />
      ) : (
        <div>-</div>
      ),
      mobile: false,
      medium: true,
    }, // summary.sales
    {
      content: currencyTotals ? (
        <FormatValue value={totals.cash} defaultValue="-" />
      ) : (
        <div>-</div>
      ),
      mobile: false,
      medium: false,
    }, // summary.cash
    {
      content: currencyTotals ? (
        <FormatValue value={totals.income} defaultValue="-" />
      ) : (
        <div>-</div>
      ),
      mobile: false,
      medium: false,
    }, // summary.dividends (income)
    {
      content: currencyTotals ? (
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
      mobile: true,
      medium: true,
    }, // summary.irr
    {
      content: currencyTotals ? (
        <FormatValue value={totals.gain} defaultValue="-" />
      ) : (
        <div>-</div>
      ),
      mobile: true,
      medium: true,
    }, // summary.gain
  ]

  return (
    <tbody>
      <tr className="bg-white">
        <td className="px-1 py-1 md:px-2 xl:px-4 text-xs md:text-sm font-medium text-left">
          {/* Portfolio name column - matches the header */}
        </td>
        {dataWithVisibility.map((item, index) => {
          let visibility
          if (item.mobile) {
            visibility = ""
          } else if (item.medium) {
            visibility = "hidden md:table-cell"
          } else {
            visibility = "hidden xl:table-cell"
          }

          return (
            <td
              key={index}
              className={`px-1 py-1 md:px-2 xl:px-4 text-xs md:text-sm font-medium text-right ${visibility}`}
            >
              {item.content}
            </td>
          )
        })}
      </tr>
    </tbody>
  )
}
