import React from "react"
import Link from "next/link"
import { Currency, Portfolio } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { deriveZenModeFromPreferences, solePortfolio } from "@lib/user/zenMode"
import { WealthSummary, LIQUIDITY_COLORS } from "@lib/wealth/liquidityGroups"

interface WealthHeroSectionProps {
  summary: WealthSummary
  displayCurrency: Currency | null
  currencies: Currency[]
  portfolios: Portfolio[]
  onCurrencyChange: (currency: Currency) => void
  onShareClick: () => void
}

const SHORTCUT_CLS =
  "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"

const WealthHeroSection: React.FC<WealthHeroSectionProps> = ({
  summary,
  displayCurrency,
  currencies,
  portfolios,
  onCurrencyChange,
  onShareClick,
}) => {
  const { hideValues } = usePrivacyMode()
  const { preferences } = useUserPreferences()

  // Zen mode (single portfolio): the portfolio list and the "across N
  // portfolios" count are noise — there's nothing to compare or navigate to.
  // Hide the entry points only; the /portfolios route stays reachable.
  const zenMode = deriveZenModeFromPreferences(portfolios.length, preferences)

  // Net worth is the sum across every contributing portfolio. Clicking it
  // drills in:
  //  - A single (active) portfolio: straight to that portfolio's holdings —
  //    aggregating one portfolio is pointless. Keyed off `solePortfolio`, the
  //    shared notion of "the one portfolio", not the zen flag: drilling needs a
  //    concrete target, which only exists when there's exactly one.
  //  - Otherwise: the aggregated holdings of exactly those portfolios. Pass the
  //    codes explicitly so the drill-down matches the wealth total even if the
  //    backend's notion of "all portfolios" ever diverges from this set.
  const sole = solePortfolio(portfolios)
  const aggregateHref = sole
    ? `/holdings/${encodeURIComponent(sole.code)}`
    : portfolios.length > 0
      ? `/holdings/aggregated?codes=${encodeURIComponent(
          portfolios.map((p) => p.code).join(","),
        )}`
      : "/holdings/aggregated"

  const previousValue = summary.totalValue - summary.totalGainOnDay
  const gainSign = summary.totalGainOnDay >= 0 ? "+" : "-"

  return (
    <section className="mb-4 rounded-lg border border-gray-200 bg-white px-5 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-sm font-medium text-gray-500">Net Worth</h1>
        <nav
          aria-label={"Wealth shortcuts"}
          className="flex items-center gap-1"
        >
          {/* Portfolios list — hidden in zen mode (a single portfolio has no
              list to browse). Route stays reachable directly. */}
          {!zenMode && (
            <Link
              href="/portfolios"
              className={SHORTCUT_CLS}
              title="Portfolios"
            >
              <i className="fas fa-chart-pie text-sm text-wealth-500"></i>
              <span className="hidden sm:inline">Portfolios</span>
            </Link>
          )}
          <Link
            href="/rebalance/wizard"
            className={SHORTCUT_CLS}
            title="Strategy"
          >
            <i className="fas fa-chess text-sm text-invest-500"></i>
            <span className="hidden sm:inline">Strategy</span>
          </Link>
          <Link
            href="/independence"
            className={SHORTCUT_CLS}
            title="Independence"
          >
            <i className="fas fa-umbrella-beach text-sm text-independence-500"></i>
            <span className="hidden sm:inline">Independence</span>
          </Link>
          {portfolios.length > 0 && (
            <button
              type="button"
              onClick={onShareClick}
              className={SHORTCUT_CLS}
              title={"Share Portfolios"}
            >
              <i className="fas fa-share-alt text-sm text-gray-400"></i>
              <span className="hidden sm:inline">{"Share"}</span>
            </button>
          )}
        </nav>
      </div>

      {/* Total value + currency selector */}
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link
          href={aggregateHref}
          title="View all holdings contributing to your net worth"
          className="rounded text-4xl font-bold tracking-tight tabular-nums text-gray-900 transition-colors hover:text-wealth-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500 sm:text-5xl"
        >
          {displayCurrency?.symbol}
          <FormatValue value={summary.totalValue} />
        </Link>
        {currencies.length > 0 && displayCurrency && (
          <select
            value={displayCurrency.code}
            onChange={(e) => {
              const selected = currencies.find((c) => c.code === e.target.value)
              if (selected) onCurrencyChange(selected)
            }}
            aria-label={"Display Currency"}
            className="cursor-pointer rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-wealth-500"
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        )}
        {summary.totalGainOnDay !== 0 && !hideValues && (
          <span
            className={`text-base font-semibold tabular-nums ${summary.totalGainOnDay > 0 ? "text-gain" : "text-loss"}`}
          >
            {gainSign}
            {displayCurrency?.symbol}
            <FormatValue value={Math.abs(summary.totalGainOnDay)} />
            {previousValue > 0 && (
              <span className="ml-1">
                ({gainSign}
                {(
                  (Math.abs(summary.totalGainOnDay) / previousValue) *
                  100
                ).toFixed(2)}
                %)
              </span>
            )}
            <span className="ml-1 text-sm font-normal text-gray-500">
              today
            </span>
          </span>
        )}
      </div>
      {!zenMode && (
        <p className="mt-1 text-sm text-gray-500">
          Across {summary.portfolioCount} portfolio
          {summary.portfolioCount !== 1 ? "s" : ""}
        </p>
      )}
      {summary.healthcareReserve > 0 && (
        <p
          className="mt-1 text-sm text-gray-500"
          title="CPF MA / Medisave is a statutory healthcare reserve — counted in Net Worth, but not freely spendable."
        >
          Includes Healthcare Reserve{" "}
          <span className="font-semibold tabular-nums text-gray-900">
            {displayCurrency?.symbol}
            <FormatValue value={summary.healthcareReserve} />
          </span>
        </p>
      )}

      {summary.classificationBreakdown.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex h-2 gap-px overflow-hidden rounded-full bg-gray-100">
            {summary.classificationBreakdown.map((item) => (
              <div
                key={item.classification}
                style={{
                  width: `${Math.max(item.percentage, 1)}%`,
                  backgroundColor:
                    LIQUIDITY_COLORS[item.classification] || "#6B7280",
                }}
                title={`${item.classification}: ${item.percentage.toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {summary.classificationBreakdown.map((item) => (
              <div
                key={item.classification}
                className="flex items-center gap-1.5 text-sm"
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      LIQUIDITY_COLORS[item.classification] || "#6B7280",
                  }}
                />
                <span className="text-gray-600">{item.classification}</span>
                <span className="font-semibold tabular-nums text-gray-900">
                  {item.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default WealthHeroSection
