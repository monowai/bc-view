import React, { ReactElement, useCallback } from "react"
import { Portfolio, PortfolioSummary } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { useTranslation } from "next-i18next"
import { Controller, useForm } from "react-hook-form"
import { useHoldingState } from "@lib/holdings/holdingState"
import Link from "next/link"
import { getTodayDate } from "@lib/dateUtils"
import { ViewMode } from "./ViewToggle"
import DateInput from "@components/ui/DateInput"
import { useRouter } from "next/router"

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
  /** If true, display "Aggregated" instead of portfolio name */
  isAggregated?: boolean
}

// Mobile/Tablet header - must be rendered OUTSIDE the table element
export function SummaryHeaderMobile({
  portfolio,
  isAggregated = false,
}: SummaryHeaderProps): ReactElement {
  const { t } = useTranslation("common")
  const { control, handleSubmit } = useForm()
  const holdingState = useHoldingState()
  const router = useRouter()

  // Display name: show "Aggregated" for aggregated views, otherwise portfolio name
  const displayName = isAggregated
    ? t("holdings.aggregated.title", "Aggregated")
    : portfolio.name

  const onSubmit = useCallback(
    (data: any): void => {
      holdingState.setAsAt(data.date)
    },
    [holdingState],
  )

  const handleDateChange = useCallback(
    (field: any) => (dateValue: string) => {
      field.onChange(dateValue)
      const date = new Date(dateValue)
      if (!isNaN(date.getTime())) {
        handleSubmit(onSubmit)()
      }
    },
    [handleSubmit, onSubmit],
  )

  return (
    <>
      {/* Mobile header - Refined styling */}
      <div className="md:hidden mx-2 mt-2">
        <div className="bg-gradient-to-r from-slate-50 to-white rounded-t-xl border border-b-0 border-slate-200/80 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* Portfolio name */}
            <h3 className="font-semibold text-sm text-slate-800 truncate flex-shrink min-w-0">
              {displayName}
              {!isAggregated && (
                <Link
                  href={`/portfolios/${portfolio.id}`}
                  className="far fa-edit text-slate-400 hover:text-blue-500 ml-1.5 transition-colors"
                />
              )}
            </h3>

            {/* Trade button + Date picker */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!isAggregated && (
                <button
                  type="button"
                  onClick={() =>
                    router.push({
                      pathname: router.pathname,
                      query: { ...router.query, action: "trade" },
                    })
                  }
                  className="inline-flex items-center justify-center w-8 h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors duration-200"
                  title={t("trade.title")}
                >
                  <i className="fas fa-exchange-alt text-sm"></i>
                </button>
              )}
              <form onSubmit={handleSubmit(onSubmit)}>
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => (
                    <DateInput
                      value={field.value || getTodayDate(holdingState.asAt)}
                      onChange={handleDateChange(field)}
                      className="input text-xs w-28"
                    />
                  )}
                />
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Tablet header */}
      <div className="hidden md:block xl:hidden mx-2 mt-2">
        <div className="bg-gradient-to-r from-slate-50 to-white rounded-t-xl border border-b-0 border-slate-200/80 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-semibold text-base text-slate-800">
              {displayName}
              {!isAggregated && (
                <Link
                  href={`/portfolios/${portfolio.id}`}
                  className="far fa-edit text-slate-400 hover:text-blue-500 ml-2 transition-colors"
                />
              )}
            </h3>
            <form onSubmit={handleSubmit(onSubmit)}>
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <DateInput
                    value={field.value || getTodayDate(holdingState.asAt)}
                    onChange={handleDateChange(field)}
                    className="input text-sm"
                  />
                )}
              />
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

// Desktop table header - renders as thead, must be inside table
export default function SummaryHeader({
  portfolio,
  portfolioSummary,
  isAggregated = false,
}: SummaryHeaderProps): ReactElement {
  const { t } = useTranslation("common")
  const { control, handleSubmit } = useForm()
  const holdingState = useHoldingState()
  const displayCurrencyOption = holdingState.displayCurrency

  // Display name: show "Aggregated" for aggregated views, otherwise portfolio name
  const displayName = isAggregated
    ? t("holdings.aggregated.title", "Aggregated")
    : portfolio.name

  // Get currency display for header - use custom display currency if set
  const displayCurrency =
    displayCurrencyOption?.mode === "CUSTOM" &&
    displayCurrencyOption?.customCode
      ? displayCurrencyOption.customCode
      : portfolioSummary?.currency?.code || "Mixed"
  const currencyTotals = portfolioSummary?.totals !== undefined
  const totals = portfolioSummary?.totals

  // Prepare desktop table data (same as in SummaryRow)
  const dataWithVisibility = [
    { content: displayCurrency, mobile: false, medium: false }, // summary.currency
    {
      content:
        currencyTotals && totals ? (
          <FormatValue value={totals.marketValue} defaultValue="-" />
        ) : (
          <div>-</div>
        ),
      mobile: true,
      medium: true,
    }, // summary.value
    {
      content:
        currencyTotals && totals ? (
          <FormatValue value={totals.purchases} defaultValue="-" />
        ) : (
          <div>-</div>
        ),
      mobile: false,
      medium: true,
    }, // summary.purchases
    {
      content:
        currencyTotals && totals ? (
          <FormatValue value={totals.sales} defaultValue="-" />
        ) : (
          <div>-</div>
        ),
      mobile: false,
      medium: true,
    }, // summary.sales
    {
      content:
        currencyTotals && totals ? (
          <FormatValue value={totals.cash} defaultValue="-" />
        ) : (
          <div>-</div>
        ),
      mobile: false,
      medium: false,
    }, // summary.cash
    {
      content:
        currencyTotals && totals ? (
          <FormatValue value={totals.income} defaultValue="-" />
        ) : (
          <div>-</div>
        ),
      mobile: false,
      medium: false,
    }, // summary.dividends (income)
    {
      content:
        currencyTotals && totals ? (
          <>
            <FormatValue
              value={totals.irr}
              defaultValue="-"
              multiplier={100}
              scale={2}
              isPublic
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
      content:
        currencyTotals && totals ? (
          <FormatValue value={totals.gain} defaultValue="-" />
        ) : (
          <div>-</div>
        ),
      mobile: true,
      medium: true,
    }, // summary.gain
  ]

  const onSubmit = useCallback(
    (data: any): void => {
      holdingState.setAsAt(data.date)
    },
    [holdingState],
  )

  const handleDateChange = useCallback(
    (field: any) => (dateValue: string) => {
      field.onChange(dateValue)
      const date = new Date(dateValue)
      if (!isNaN(date.getTime())) {
        handleSubmit(onSubmit)()
      }
    },
    [handleSubmit, onSubmit],
  )

  // Determine IRR color
  const irrValue = totals?.irr || 0
  const irrColorClass =
    irrValue > 0
      ? "text-emerald-600"
      : irrValue < 0
        ? "text-red-600"
        : "text-slate-700"

  // Determine gain color
  const gainValue = totals?.gain || 0
  const gainColorClass =
    gainValue > 0
      ? "text-emerald-600"
      : gainValue < 0
        ? "text-red-600"
        : "text-slate-700"

  return (
    <thead className="hidden xl:table-header-group">
      {/* Header row with portfolio name and column labels */}
      <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
        <th className="px-3 py-2.5 text-sm text-left font-semibold text-slate-800">
          {displayName}
          {!isAggregated && (
            <Link
              href={`/portfolios/${portfolio.id}`}
              className="far fa-edit text-slate-400 hover:text-blue-500 ml-2 transition-colors"
            />
          )}
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
              className={`px-2 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 text-${header.align} ${visibility}`}
            >
              {t(header.key)}
            </th>
          )
        })}
      </tr>
      {/* Values row with refined styling */}
      <tr className="bg-gradient-to-br from-slate-50 via-white to-blue-50/20 border-b border-slate-200/60">
        <td className="px-3 py-3 text-sm font-medium text-slate-700">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <DateInput
                  value={field.value || getTodayDate(holdingState.asAt)}
                  onChange={handleDateChange(field)}
                  className="input text-sm font-medium"
                />
              )}
            />
          </form>
        </td>
        {/* Summary values with enhanced styling */}
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

          // Apply color coding to IRR (index 6) and Gain (index 7)
          let colorClass = "text-slate-800"
          if (index === 6) colorClass = irrColorClass
          if (index === 7) colorClass = gainColorClass

          return (
            <td
              key={index}
              className={`px-2 py-3 text-sm font-semibold font-mono tabular-nums text-${alignment} ${visibility} ${colorClass}`}
            >
              {item.content}
            </td>
          )
        })}
      </tr>
    </thead>
  )
}

// Mobile/Tablet summary row - must be rendered OUTSIDE the table element
export function SummaryRowMobile({
  totals,
  currency,
}: PortfolioSummary): ReactElement {
  const { t } = useTranslation("common")
  const holdingState = useHoldingState()
  const displayCurrencyOption = holdingState.displayCurrency
  const currencyTotals = totals !== undefined

  // Get effective display currency code
  const displayCurrencyCode =
    displayCurrencyOption?.mode === "CUSTOM" &&
    displayCurrencyOption?.customCode
      ? displayCurrencyOption.customCode
      : currency?.code

  // Determine IRR color
  const irrValue = totals?.irr || 0
  const irrColorClass =
    irrValue > 0
      ? "text-emerald-600"
      : irrValue < 0
        ? "text-red-600"
        : "text-slate-700"

  // Determine gain color
  const gainValue = totals?.gain || 0
  const gainColorClass =
    gainValue > 0
      ? "text-emerald-600"
      : gainValue < 0
        ? "text-red-600"
        : "text-slate-700"

  return (
    <div className="xl:hidden mx-2 my-3 relative">
      {/* Refined summary card with subtle gradient and shadow */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/30 rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Top accent line */}
        <div className="h-0.5 bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-400" />

        <div className="px-4 py-4 md:px-6 md:py-5">
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-6">
            {/* Market Value - Primary metric */}
            <div className="text-center">
              <div className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                {t("summary.value")}
              </div>
              <div className="font-semibold text-lg md:text-2xl text-slate-800 font-mono tabular-nums">
                {currencyTotals ? (
                  <FormatValue value={totals.marketValue} defaultValue="-" />
                ) : (
                  "-"
                )}
              </div>
              {displayCurrencyCode && (
                <div className="text-[10px] md:text-xs text-slate-400 mt-0.5">
                  {displayCurrencyCode}
                </div>
              )}
            </div>

            {/* Dividends - Hidden on mobile */}
            <div className="hidden md:block text-center">
              <div className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                {t("summary.dividends")}
              </div>
              <div className="font-semibold text-lg md:text-2xl text-slate-700 font-mono tabular-nums">
                {currencyTotals ? (
                  <FormatValue value={totals.income} defaultValue="-" />
                ) : (
                  "-"
                )}
              </div>
            </div>

            {/* Gain - Color coded */}
            <div className="text-center">
              <div className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                {t("summary.gain")}
              </div>
              <div
                className={`font-semibold text-lg md:text-2xl font-mono tabular-nums ${gainColorClass}`}
              >
                {currencyTotals ? (
                  <FormatValue value={totals.gain} defaultValue="-" />
                ) : (
                  "-"
                )}
              </div>
            </div>

            {/* IRR - Color coded with background pill */}
            <div className="text-center">
              <div className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                {t("summary.irr")}
              </div>
              <div
                className={`inline-flex items-center font-semibold text-lg md:text-2xl font-mono tabular-nums ${irrColorClass}`}
              >
                {currencyTotals ? (
                  <>
                    <FormatValue
                      value={totals.irr}
                      defaultValue="-"
                      multiplier={100}
                      scale={2}
                    />
                    <span className="text-sm md:text-lg ml-0.5">%</span>
                  </>
                ) : (
                  "-"
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Desktop summary row - returns empty fragment as values are now in SummaryHeader
// This component exists for backward compatibility but doesn't render anything
// Use SummaryRowMobile for mobile/tablet views (must be rendered outside table)
export function SummaryRow(): ReactElement {
  return <></>
}
