import React, { ReactElement, useCallback } from "react"
import { Portfolio, PortfolioSummary } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { useTranslation } from "next-i18next"
import { Controller, useForm } from "react-hook-form"
import { useHoldingState } from "@lib/holdings/holdingState"
import Link from "next/link"
import { getTodayDate } from "@lib/dateUtils"
import ViewToggle, { ViewMode } from "./ViewToggle"

export const headers = [
  {
    key: "summary.currency",
    align: "left" as const,
    mobile: false,
    medium: false,
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

interface SummaryHeaderProps {
  portfolio: Portfolio
  portfolioSummary?: PortfolioSummary
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
}

export default function SummaryHeader({
  portfolio,
  portfolioSummary,
  viewMode,
  onViewModeChange,
}: SummaryHeaderProps): ReactElement {
  const { t } = useTranslation("common")
  const { control, handleSubmit } = useForm()
  const holdingState = useHoldingState()

  // Get currency display for header
  const displayCurrency = portfolioSummary?.currency?.code || "Mixed"

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
    <>
      {/* Mobile header - Single row layout */}
      <div className="md:hidden bg-gray-100 p-2 mx-2 mt-2 rounded-t-lg border border-b-0 border-gray-200">
        <div className="flex items-center justify-between gap-2">
          {/* Portfolio name - truncate if too long */}
          <h3 className="font-medium text-xs text-gray-900 truncate flex-shrink min-w-0">
            {portfolio.name}
            <Link
              href={`/portfolios/${portfolio.id}`}
              className="far fa-edit text-gray-500 hover:text-gray-700 ml-1"
            />
          </h3>

          {/* View toggle buttons - center */}
          {viewMode && onViewModeChange && (
            <div className="flex-shrink-0">
              <ViewToggle
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
              />
            </div>
          )}

          {/* Date picker - right */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex items-center gap-1 flex-shrink-0"
          >
            <span className="text-xs text-gray-600">@</span>
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="date"
                  defaultValue={getTodayDate(holdingState.asAt)}
                  className="input text-xs w-28"
                  onChange={handleDateChange(field)}
                />
              )}
            />
          </form>
        </div>
      </div>

      {/* Tablet header */}
      <div className="hidden md:block xl:hidden bg-gray-100 p-4 mx-2 mt-2 rounded-t-lg border border-b-0 border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-medium text-base text-gray-900">
              {portfolio.name}
              <Link
                href={`/portfolios/${portfolio.id}`}
                className="far fa-edit text-gray-500 hover:text-gray-700 ml-2"
              />
            </h3>
          </div>
          {viewMode && onViewModeChange && (
            <div className="flex-shrink-0">
              <ViewToggle
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
              />
            </div>
          )}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex items-center gap-2"
          >
            <span className="text-sm text-gray-600">@</span>
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="date"
                  defaultValue={getTodayDate(holdingState.asAt)}
                  className="input text-sm"
                  onChange={handleDateChange(field)}
                />
              )}
            />
          </form>
        </div>
      </div>

      {/* Desktop table header */}
      <thead className="hidden xl:table-header-group">
        <tr className="bg-gray-200">
          <th className="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-left">
            {portfolio.name}
            <Link
              href={`/portfolios/${portfolio.id}`}
              className="far fa-edit text-gray-500 hover:text-gray-700 ml-2"
            />
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
                className={`px-1 py-2 md:px-2 xl:px-4 text-xs md:text-sm font-medium text-${header.align} ${visibility}`}
              >
                {t(header.key)}
              </th>
            )
          })}
        </tr>
        <tr className="bg-gray-100">
          <td
            colSpan={headers.length + 1}
            className="px-2 py-2 text-xs text-gray-600"
          >
            <div className="flex items-center justify-between">
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="flex items-center gap-2"
              >
                <span>@</span>
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="date"
                      defaultValue={getTodayDate(holdingState.asAt)}
                      className="input text-xs"
                      onChange={handleDateChange(field)}
                    />
                  )}
                />
              </form>
              {portfolioSummary?.currency?.code && (
                <span className="xl:hidden font-medium">{displayCurrency}</span>
              )}
            </div>
          </td>
        </tr>
      </thead>
    </>
  )
}

export function SummaryRow({
  totals,
  currency,
}: PortfolioSummary): ReactElement {
  const { t } = useTranslation("common")
  const currencyTotals = totals !== undefined
  const displayCurrency = currency?.code || "Mixed"

  // Unified horizontal card layout for all non-desktop screens - DRAMATICALLY improved spacing
  const HorizontalCard = (): ReactElement => (
    <div className="xl:hidden bg-white rounded-lg border border-gray-200 mx-4 my-4 px-6 py-5 md:px-8 md:py-6 relative">
      {/* DEBUG: Show which layout is active */}
      {process.env.NODE_ENV === "development" && (
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-bold">
          <span className="md:hidden">MOBILE</span>
          <span className="hidden md:inline xl:hidden">TABLET</span>
        </div>
      )}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-x-8 md:gap-x-12 text-xs md:text-sm">
        <div className="text-center min-w-0">
          <div className="text-gray-500 font-medium text-xs md:text-sm mb-3 leading-relaxed">
            {t("summary.value")}
          </div>
          <div className="font-bold text-base md:text-xl">
            {currencyTotals ? (
              <FormatValue value={totals.marketValue} defaultValue="-" />
            ) : (
              "-"
            )}
            {currency?.code && (
              <div className="text-gray-500 text-xs">{currency.code}</div>
            )}
          </div>
        </div>
        <div className="hidden md:block text-center min-w-0">
          <div className="text-gray-500 font-medium text-xs md:text-sm mb-3 leading-relaxed">
            {t("summary.dividends")}
          </div>
          <div className="font-bold text-base md:text-xl">
            {currencyTotals ? (
              <FormatValue value={totals.income} defaultValue="-" />
            ) : (
              "-"
            )}
          </div>
        </div>
        <div className="text-center min-w-0">
          <div className="text-gray-500 font-medium text-xs md:text-sm mb-3 leading-relaxed">
            {t("summary.gain")}
          </div>
          <div className="font-bold text-base md:text-xl">
            {currencyTotals ? (
              <FormatValue value={totals.gain} defaultValue="-" />
            ) : (
              "-"
            )}
          </div>
        </div>
        <div className="text-center min-w-0">
          <div className="text-gray-500 font-medium text-xs md:text-sm mb-3 leading-relaxed">
            {t("summary.irr")}
          </div>
          <div className="font-bold text-base md:text-xl">
            {currencyTotals ? (
              <>
                <FormatValue
                  value={totals.irr}
                  defaultValue="-"
                  multiplier={100}
                  scale={2}
                />
                %
              </>
            ) : (
              "-"
            )}
          </div>
        </div>
      </div>
    </div>
  )

  // Traditional table layout for medium+ screens
  const dataWithVisibility = [
    { content: displayCurrency, mobile: false, medium: false }, // summary.currency
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
    <>
      {/* Unified horizontal card layout for all non-desktop screens */}
      <HorizontalCard />

      {/* Traditional table layout for desktop screens */}
      <tbody className="hidden xl:table-row-group relative">
        {/* DEBUG: Desktop table indicator */}
        {process.env.NODE_ENV === "development" && (
          <tr>
            <td colSpan={100} className="relative">
              <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold z-10">
                DESKTOP TABLE
              </div>
            </td>
          </tr>
        )}
        <tr className="bg-white">
          <td className="px-1 py-1 md:px-2 xl:px-4 text-xs md:text-sm font-medium text-left">
            {/* Empty cell for portfolio name column */}
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

            // Get alignment from headers array
            const alignment = headers[index]?.align || "right"

            return (
              <td
                key={index}
                className={`px-1 py-1 md:px-2 xl:px-4 text-xs md:text-sm font-medium text-${alignment} ${visibility}`}
              >
                {item.content}
              </td>
            )
          })}
        </tr>
      </tbody>
    </>
  )
}
