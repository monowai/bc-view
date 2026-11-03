import React, { useMemo, useState, useCallback, useEffect } from "react"
import { useRouter } from "next/router"
import Link from "next/link"
import { Portfolio, Currency } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { QuickTooltip } from "@components/ui/Tooltip"
import PortfolioActions from "./PortfolioActions"
import PortfolioRowActions from "./PortfolioRowActions"
import { getSortIcon, SortConfig } from "@lib/sortIcon"
import { usePermissions } from "@hooks/usePermissions"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { usePortfolioReview } from "@components/features/portfolios/usePortfolioReview"
import { convertAt, sumConverted } from "@lib/currency"
import { todayIso } from "@lib/formatters"

interface PortfoliosListProps {
  portfolios: Portfolio[]
  displayCurrency: Currency | null
  currencies: Currency[]
  fxRates: Record<string, number>
  onCurrencyChange: (currency: Currency) => void
  onImportClick: () => void
  onShareClick: (portfolioId?: string) => void
  onConsolidateClick?: () => void
  onCorporateActions: (portfolio: Portfolio) => void
  onDelete: (target: { id: string; code: string }) => void
  isInactiveTab?: boolean
}

const SECONDARY_BUTTON_CLS =
  "inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"

const SELECTED_STORAGE_KEY = "bc-portfolios-selected"

function loadSelectedCodes(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(SELECTED_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === "string")
  } catch {
    return []
  }
}

function saveSelectedCodes(codes: string[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(SELECTED_STORAGE_KEY, JSON.stringify(codes))
  } catch {
    // Quota / private mode — selection just won't persist.
  }
}

// Check if valuation date is stale (not today)
function isStale(valuedAt: string | undefined): boolean {
  if (!valuedAt) return true
  return valuedAt !== todayIso()
}

// Format the valued at date for display
function formatValuedAt(valuedAt: string | undefined): string {
  if (!valuedAt) return "-"
  const date = new Date(valuedAt)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

// Format the lastUpdated timestamp for tooltip
function formatLastUpdated(lastUpdated: string | undefined): string {
  if (!lastUpdated) return ""
  const date = new Date(lastUpdated)
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

// Shown in place of a value that cannot be converted for want of an FX rate.
const NO_RATE = "–"

function gainOnDayText(
  gainOnDay: number | undefined,
  displayCurrency: Currency | null,
): string {
  if (gainOnDay === undefined) return NO_RATE
  const amount = gainOnDay.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${gainOnDay >= 0 ? "+" : ""}${displayCurrency?.code || ""} ${amount}`
}

// Gain-on-day percentage: undefined when there is no previous value to compare.
function gainOnDayPercent(
  gainOnDay: number,
  marketValue: number,
): number | undefined {
  const previousValue = marketValue - gainOnDay
  if (previousValue === 0) return undefined
  return (gainOnDay / previousValue) * 100
}

function signedPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`
}

function toneClass(value: number): string {
  if (value > 0) return "text-gain"
  if (value < 0) return "text-loss"
  return "text-gray-500"
}

function currencyMark(currency: Currency | null): string | undefined {
  return currency?.symbol === "?" ? currency.code : currency?.symbol
}

/** A signed return; sign and colour both carry the direction. */
const SignedPercent: React.FC<{ value: number | undefined }> = ({ value }) =>
  value === undefined ? (
    <span className="text-gray-500">{NO_RATE}</span>
  ) : (
    <span className={`font-medium tabular-nums ${toneClass(value)}`}>
      {signedPercent(value)}
    </span>
  )

/** Move on the day: the percent, with the amount on hover unless values are hidden. */
const DayMove: React.FC<{
  gain: number | undefined
  convertedGain: number | undefined
  marketValue: number | undefined
  displayCurrency: Currency | null
}> = ({ gain, convertedGain, marketValue, displayCurrency }) => {
  const { hideValues } = usePrivacyMode()
  if (!gain || !marketValue) {
    return <span className="text-gray-500">{NO_RATE}</span>
  }
  const percent = <SignedPercent value={gainOnDayPercent(gain, marketValue)} />
  if (hideValues) return percent
  return (
    <QuickTooltip text={gainOnDayText(convertedGain, displayCurrency)}>
      {percent}
    </QuickTooltip>
  )
}

/** Share of the book: a figure, with a hairline bar for reading concentration. */
const ShareOfTotal: React.FC<{
  share: number | undefined
  compact?: boolean
}> = ({ share, compact = false }) => {
  if (share === undefined) {
    return <span className="text-gray-500">{NO_RATE}</span>
  }
  const figure = `${share.toFixed(1)}%`
  if (compact) return <span className="tabular-nums">{figure}</span>
  return (
    <span className="flex items-center justify-end gap-2">
      <span
        className="hidden lg:block h-1 w-14 overflow-hidden rounded-full bg-gray-100"
        aria-hidden="true"
      >
        <span
          className="block h-full bg-wealth-500"
          style={{ width: `${Math.min(Math.max(share, 0), 100)}%` }}
        />
      </span>
      <span className="w-12 text-right text-sm tabular-nums text-gray-600">
        {figure}
      </span>
    </span>
  )
}

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const

const SortHeader: React.FC<{
  label: string
  sortKey: string
  sortConfig: SortConfig
  onSort: (key: string) => void
  align?: "left" | "right" | "center"
  className?: string
}> = ({
  label,
  sortKey,
  sortConfig,
  onSort,
  align = "left",
  className = "",
}) => {
  const sorted = sortConfig.key === sortKey
  const justify = {
    left: "justify-start",
    right: "justify-end",
    center: "justify-center",
  }[align]
  return (
    <th
      scope="col"
      aria-sort={sorted ? ARIA_SORT[sortConfig.direction] : "none"}
      className={`px-4 py-2.5 hover:bg-gray-50 ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex w-full items-center ${justify} rounded-sm text-xs font-medium tracking-wide text-gray-500 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500`}
      >
        {label}
        {getSortIcon(sortKey, sortConfig)}
      </button>
    </th>
  )
}

function sortPortfolios(
  portfolios: Portfolio[],
  sortConfig: SortConfig,
): Portfolio[] {
  if (!sortConfig.key) return portfolios

  return [...portfolios].sort((a, b) => {
    let aValue: string | number = ""
    let bValue: string | number = ""

    switch (sortConfig.key) {
      case "code":
        aValue = a.code.toLowerCase()
        bValue = b.code.toLowerCase()
        break
      case "name":
        aValue = a.name.toLowerCase()
        bValue = b.name.toLowerCase()
        break
      case "currency":
        aValue = a.currency.code.toLowerCase()
        bValue = b.currency.code.toLowerCase()
        break
      case "base":
        aValue = a.base.code.toLowerCase()
        bValue = b.base.code.toLowerCase()
        break
      case "marketValue":
        aValue = a.marketValue || 0
        bValue = b.marketValue || 0
        break
      case "irr":
        aValue = a.irr || 0
        bValue = b.irr || 0
        break
      case "gainOnDay":
        aValue = a.gainOnDay || 0
        bValue = b.gainOnDay || 0
        break
      case "gainOnDayPercent": {
        const aPrev = (a.marketValue || 0) - (a.gainOnDay || 0)
        aValue = aPrev !== 0 ? (a.gainOnDay || 0) / aPrev : 0
        const bPrev = (b.marketValue || 0) - (b.gainOnDay || 0)
        bValue = bPrev !== 0 ? (b.gainOnDay || 0) / bPrev : 0
        break
      }
      case "valuedAt":
        aValue = a.valuedAt || ""
        bValue = b.valuedAt || ""
        break
      default:
        return 0
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      const result = aValue.localeCompare(bValue)
      return sortConfig.direction === "asc" ? result : -result
    }
    const result = (aValue as number) - (bValue as number)
    return sortConfig.direction === "asc" ? result : -result
  })
}

const PortfoliosList: React.FC<PortfoliosListProps> = ({
  portfolios,
  displayCurrency,
  currencies,
  fxRates,
  onCurrencyChange,
  onImportClick,
  onShareClick,
  onConsolidateClick,
  onCorporateActions,
  onDelete,
  isInactiveTab = false,
}) => {
  const router = useRouter()
  const { canUseAi } = usePermissions()
  const { popup: reviewPopup, showReview } = usePortfolioReview()

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "code",
    direction: "asc",
  })

  const [selectedPortfolios, setSelectedPortfolios] = useState<Set<string>>(
    () => new Set(loadSelectedCodes()),
  )

  const sortedPortfolios = useMemo(
    () => sortPortfolios(portfolios, sortConfig),
    [portfolios, sortConfig],
  )

  // Effective selection intersects stored state with currently-visible
  // portfolios — codes from a prior session that have since been deleted
  // are silently dropped so the count/UI stays honest.
  const effectiveSelected = useMemo(() => {
    const available = new Set(portfolios.map((p) => p.code))
    const next = new Set<string>()
    selectedPortfolios.forEach((code) => {
      if (available.has(code)) next.add(code)
    })
    return next
  }, [portfolios, selectedPortfolios])

  useEffect(() => {
    saveSelectedCodes(Array.from(effectiveSelected))
  }, [effectiveSelected])

  const handleSort = (key: string): void => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      return { key, direction: key === "code" ? "asc" : "desc" }
    })
  }

  const togglePortfolioSelection = useCallback((code: string) => {
    setSelectedPortfolios((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(code)) {
        newSet.delete(code)
      } else {
        newSet.add(code)
      }
      return newSet
    })
  }, [])

  const toggleAllSelection = useCallback(() => {
    setSelectedPortfolios((prev) =>
      prev.size === portfolios.length
        ? new Set<string>()
        : new Set(portfolios.map((p) => p.code)),
    )
  }, [portfolios])

  const clearSelection = useCallback(() => {
    setSelectedPortfolios(new Set<string>())
  }, [])

  const handleViewAggregated = useCallback(() => {
    if (effectiveSelected.size === 0) return
    const codes = Array.from(effectiveSelected).join(",")
    router.push(`/holdings/aggregated?codes=${encodeURIComponent(codes)}`)
  }, [effectiveSelected, router])

  if (!portfolios || portfolios.length === 0) {
    if (isInactiveTab) {
      return (
        <div className="min-h-screen px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-archive text-xl text-gray-400"></i>
            </div>
            <p className="text-gray-500">{"No inactive portfolios"}</p>
          </div>
        </div>
      )
    }
    return (
      <div className="min-h-screen px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            {"No portfolios yet"}
          </h2>
          <p className="text-gray-600 mb-8 text-center">
            {"You have no portfolios"}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/onboarding"
              className="bg-white border border-gray-200 rounded-lg p-6 text-center hover:border-wealth-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"
            >
              <div className="w-12 h-12 bg-wealth-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-rocket text-xl text-wealth-500"></i>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                {"Start Setup"}
              </h3>
              <p className="text-gray-500 text-sm">
                {"Guided setup for bank accounts, property, and pensions"}
              </p>
            </Link>

            <Link
              href="/portfolios/__NEW__"
              className="bg-white border border-gray-200 rounded-lg p-6 text-center hover:border-wealth-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"
            >
              <div className="w-12 h-12 bg-wealth-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-plus text-xl text-wealth-500"></i>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{"Add"}</h3>
              <p className="text-gray-500 text-sm">
                {"Create a portfolio directly with full control"}
              </p>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // A portfolio already in the display currency needs no rate; any other
  // without one shows a placeholder and keeps the total from being summed.
  const rateFor = (portfolio: Portfolio): number | undefined =>
    portfolio.base.code === displayCurrency?.code
      ? 1
      : fxRates[portfolio.base.code]

  const rows = sortedPortfolios.map((portfolio) => ({
    portfolio,
    value: convertAt(portfolio.marketValue || 0, rateFor(portfolio)),
    gain: convertAt(portfolio.gainOnDay || 0, rateFor(portfolio)),
    selected: effectiveSelected.has(portfolio.code),
  }))

  const totalMarketValue = sumConverted(rows.map((row) => row.value))
  const totalGainOnDay = sumConverted(rows.map((row) => row.gain))
  const selectedValue = sumConverted(
    rows.filter((row) => row.selected).map((row) => row.value),
  )

  const shareOf = (value: number | undefined): number | undefined =>
    value !== undefined && totalMarketValue
      ? (value / totalMarketValue) * 100
      : undefined

  const allSelected =
    portfolios.length > 0 && effectiveSelected.size === portfolios.length

  const mark = currencyMark(displayCurrency)

  const openReview = (portfolio: Portfolio): void =>
    showReview({
      kind: "portfolio",
      id: portfolio.id,
      code: portfolio.code,
      name: portfolio.name,
    })

  const rowActions = (
    portfolio: Portfolio,
    size: "touch" | "compact",
  ): React.ReactElement => (
    <PortfolioRowActions
      portfolio={portfolio}
      canUseAi={canUseAi}
      size={size}
      onReview={openReview}
      onShare={onShareClick}
      onCorporateActions={onCorporateActions}
      onDelete={onDelete}
    />
  )

  return (
    <>
      <div
        className={`min-h-screen ${effectiveSelected.size > 0 ? "pb-24" : ""}`}
      >
        {/* Header: the page's one primary figure leads */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 pt-4 pb-5">
            <div className="flex justify-between items-center gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => router.push("/wealth")}
                  className="text-gray-500 hover:text-gray-900 p-1 -ml-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"
                  title={"Wealth"}
                  aria-label={"Back to Wealth"}
                >
                  <i className="fas fa-arrow-left"></i>
                </button>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
                  {"Portfolios"}
                </h1>
                {currencies.length > 0 && displayCurrency && (
                  <select
                    value={displayCurrency.code}
                    onChange={(e) => {
                      const selected = currencies.find(
                        (c) => c.code === e.target.value,
                      )
                      if (selected) onCurrencyChange(selected)
                    }}
                    className="border border-gray-200 rounded-md px-2 py-1 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-wealth-500"
                    title={"Display Currency"}
                    aria-label={"Display Currency"}
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.symbol} {c.code}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <PortfolioActions
                onImportClick={onImportClick}
                onShareClick={() => onShareClick()}
                onConsolidateClick={onConsolidateClick}
              />
            </div>

            <div
              data-testid="portfolios-summary"
              className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1"
            >
              <span className="text-3xl font-bold tracking-tight tabular-nums text-gray-900">
                {mark}
                <FormatValue value={totalMarketValue} defaultValue={NO_RATE} />
              </span>
              {totalGainOnDay !== undefined && totalMarketValue ? (
                <span className="flex items-baseline gap-1.5 text-sm">
                  <SignedPercent
                    value={gainOnDayPercent(totalGainOnDay, totalMarketValue)}
                  />
                  <span className="text-gray-500">{"today"}</span>
                </span>
              ) : null}
              <span className="text-sm text-gray-500">
                {portfolios.length}{" "}
                {portfolios.length === 1 ? "portfolio" : "portfolios"}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile: Card layout */}
        <div className="md:hidden px-4 py-4 space-y-2">
          <div className="flex items-center justify-between px-1">
            <label
              className="flex items-center space-x-3 py-2 pr-3 cursor-pointer select-none"
              aria-label={"Select all portfolios"}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAllSelection}
                className="w-5 h-5 text-wealth-600 rounded border-gray-300 focus:ring-wealth-500 cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-700">
                {allSelected ? "Deselect all" : "Select all"}
              </span>
            </label>
            <span className="text-xs text-gray-500">
              {effectiveSelected.size}/{portfolios.length} {"selected"}
            </span>
          </div>

          {rows.map(({ portfolio, value, gain, selected }) => (
            <div
              key={portfolio.id}
              className={`rounded-lg border overflow-hidden flex ${
                selected
                  ? "border-wealth-500 bg-wealth-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              {/* Dedicated checkbox tap zone — outside the navigate region.
                  Wide enough to clear the 44px iOS HIG minimum so users
                  can toggle without accidentally opening the portfolio.
                  Uses `button` not `label` — a label wrapping a checkbox
                  re-dispatches click to the input, firing the handler
                  twice (toggle then toggle = no-op). The inner checkbox
                  is purely visual (aria-hidden, no handlers). */}
              <button
                type="button"
                role="checkbox"
                aria-checked={selected}
                aria-label={`Select ${portfolio.code}`}
                className="flex items-start justify-center px-4 py-4 cursor-pointer select-none"
                onClick={(e) => {
                  e.stopPropagation()
                  togglePortfolioSelection(portfolio.code)
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  readOnly
                  tabIndex={-1}
                  aria-hidden="true"
                  className="w-5 h-5 text-wealth-600 rounded border-gray-300 focus:ring-wealth-500 pointer-events-none"
                />
              </button>
              <div
                className="flex-1 min-w-0 py-3 pr-2 cursor-pointer"
                onClick={() => router.push(`/holdings/${portfolio.code}`)}
              >
                <div className="flex justify-between items-start gap-3 pr-2">
                  <div className="min-w-0">
                    <Link
                      href={`/holdings/${portfolio.code}`}
                      className="text-sm font-semibold text-wealth-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {portfolio.code}
                    </Link>
                    <div className="truncate text-sm text-gray-900">
                      {portfolio.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs tabular-nums text-gray-500">
                      <span>
                        {portfolio.base.symbol}
                        {portfolio.base.code}
                      </span>
                      <ShareOfTotal share={shareOf(value)} compact />
                      {isStale(portfolio.valuedAt) && (
                        <span
                          className="text-amber-600"
                          title={`Valued: ${formatValuedAt(portfolio.valuedAt)}${portfolio.lastUpdated ? ` (Updated: ${formatLastUpdated(portfolio.lastUpdated)})` : ""}`}
                        >
                          <i className="fas fa-clock text-xs"></i>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-semibold tabular-nums text-gray-900">
                      {mark}
                      <FormatValue value={value} defaultValue={NO_RATE} />
                    </div>
                    <div className="text-sm">
                      <DayMove
                        gain={portfolio.gainOnDay}
                        convertedGain={gain}
                        marketValue={portfolio.marketValue}
                        displayCurrency={displayCurrency}
                      />
                    </div>
                    <div className="text-sm">
                      <SignedPercent
                        value={
                          portfolio.irr === undefined
                            ? undefined
                            : portfolio.irr * 100
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-1 -mb-1">
                  {rowActions(portfolio, "touch")}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: Table layout */}
        <div className="hidden md:block px-4 py-4">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full">
              <thead className="border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-center w-12">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAllSelection}
                      className="w-4 h-4 text-wealth-600 rounded border-gray-300 focus:ring-wealth-500 cursor-pointer"
                      title={"Select all"}
                      aria-label={"Select all portfolios"}
                    />
                  </th>
                  <SortHeader
                    label={"Code"}
                    sortKey="code"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label={"Name"}
                    sortKey="name"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label={"Market Value"}
                    sortKey="marketValue"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    align="right"
                  />
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right text-xs font-medium tracking-wide text-gray-500"
                  >
                    {"Share"}
                  </th>
                  <SortHeader
                    label={"Day %"}
                    sortKey="gainOnDayPercent"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortHeader
                    label={"IRR"}
                    sortKey="irr"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortHeader
                    label={"Valued"}
                    sortKey="valuedAt"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    align="right"
                    className="hidden xl:table-cell"
                  />
                  <th scope="col" className="w-44 px-4 py-2.5">
                    <span className="sr-only">{"Actions"}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(({ portfolio, value, gain, selected }) => (
                  <tr
                    key={portfolio.id}
                    className={`group cursor-pointer ${
                      selected
                        ? "bg-wealth-50 hover:bg-wealth-100"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={(e) => {
                      if (
                        !(e.target as HTMLElement).closest(
                          ".action-buttons, .selection-checkbox, a",
                        )
                      ) {
                        router.push(`/holdings/${portfolio.code}`)
                      }
                    }}
                  >
                    <td className="px-4 py-2.5 text-center selection-checkbox">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          togglePortfolioSelection(portfolio.code)
                        }
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${portfolio.code}`}
                        className="w-4 h-4 text-wealth-600 rounded border-gray-300 focus:ring-wealth-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/holdings/${portfolio.code}`}
                        className="text-sm font-semibold text-wealth-600 rounded-sm hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"
                      >
                        {portfolio.code}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-900">
                      {portfolio.name}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900">
                      <FormatValue value={value} defaultValue={NO_RATE} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ShareOfTotal share={shareOf(value)} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm">
                      <DayMove
                        gain={portfolio.gainOnDay}
                        convertedGain={gain}
                        marketValue={portfolio.marketValue}
                        displayCurrency={displayCurrency}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm">
                      <SignedPercent
                        value={
                          portfolio.irr === undefined
                            ? undefined
                            : portfolio.irr * 100
                        }
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm text-gray-500 whitespace-nowrap hidden xl:table-cell">
                      <span
                        title={
                          portfolio.valuedAt
                            ? `Valued: ${portfolio.valuedAt}${portfolio.lastUpdated ? ` (Updated: ${formatLastUpdated(portfolio.lastUpdated)})` : ""}`
                            : "Not yet valued"
                        }
                      >
                        {isStale(portfolio.valuedAt) && (
                          <i className="fas fa-clock mr-1.5 text-xs text-amber-600"></i>
                        )}
                        {formatValuedAt(portfolio.valuedAt)}
                      </span>
                    </td>
                    <td className="px-4 py-1">
                      {/* Quiet until the row is in play; always there for touch and keyboard. */}
                      <div className="[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100">
                        {rowActions(portfolio, "compact")}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-2.5 text-sm font-medium text-gray-500"
                  >
                    {"Total"}: {displayCurrency?.code}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-gray-900">
                    {mark}
                    <FormatValue
                      value={totalMarketValue}
                      defaultValue={NO_RATE}
                    />
                  </td>
                  <td></td>
                  <td className="px-4 py-2.5 text-right text-sm">
                    <DayMove
                      gain={totalGainOnDay}
                      convertedGain={totalGainOnDay}
                      marketValue={totalMarketValue}
                      displayCurrency={displayCurrency}
                    />
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {effectiveSelected.size > 0 && (
        <div
          role="region"
          aria-label={"Selected portfolios"}
          className="fixed bottom-4 left-1/2 z-20 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-lg bg-white px-3 sm:px-4 py-2.5 shadow-[0_2px_10px_rgb(0_0_0/0.1)] animate-menu-in"
        >
          <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
            {effectiveSelected.size} {"selected"}
          </span>
          <span className="hidden sm:inline text-sm tabular-nums text-gray-600">
            {mark}
            <FormatValue value={selectedValue} defaultValue={NO_RATE} />
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="text-sm text-gray-500 hover:text-gray-900 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"
          >
            {"Clear"}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLS}
              onClick={() => {
                const codes = Array.from(effectiveSelected).join(",")
                router.push(
                  `/rebalance/wizard?portfolios=${encodeURIComponent(codes)}`,
                )
              }}
            >
              <span className="hidden sm:inline">
                <i className="fas fa-balance-scale mr-1.5"></i>
              </span>
              {"Rebalance"}
            </button>
            <button
              type="button"
              className="btn-primary btn-primary--sm"
              title={"View selected portfolios as one"}
              onClick={handleViewAggregated}
            >
              <span className="hidden sm:inline">
                <i className="fas fa-layer-group mr-1.5"></i>
              </span>
              {"Holdings"}
            </button>
          </div>
        </div>
      )}
      {reviewPopup}
    </>
  )
}

export default PortfoliosList
