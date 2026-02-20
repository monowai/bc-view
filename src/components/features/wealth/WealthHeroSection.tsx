import React from "react"
import Link from "next/link"
import { useTranslation } from "next-i18next"
import { Currency, Portfolio } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { WealthSummary, LIQUIDITY_COLORS } from "@lib/wealth/liquidityGroups"

interface WealthHeroSectionProps {
  summary: WealthSummary
  displayCurrency: Currency | null
  currencies: Currency[]
  portfolios: Portfolio[]
  onCurrencyChange: (currency: Currency) => void
  onShareClick: () => void
}

const WealthHeroSection: React.FC<WealthHeroSectionProps> = ({
  summary,
  displayCurrency,
  currencies,
  portfolios,
  onCurrencyChange,
  onShareClick,
}) => {
  const { t } = useTranslation("common")
  const { hideValues } = usePrivacyMode()

  return (
    <div className="bg-linear-to-br from-blue-500 to-blue-700 rounded-2xl shadow-xl mb-8 overflow-hidden">
      {/* Title */}
      <div className="px-8 pt-6 pb-3">
        <h1 className="text-sm font-semibold uppercase tracking-widest text-white/80">
          Net Worth
        </h1>
      </div>

      {/* Total value + currency selector */}
      <div className="px-8">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-4xl sm:text-5xl font-bold text-white tracking-tight tabular-nums">
            {displayCurrency?.symbol}
            <FormatValue value={summary.totalValue} />
          </span>
          {currencies.length > 0 && displayCurrency && (
            <select
              value={displayCurrency.code}
              onChange={(e) => {
                const selected = currencies.find(
                  (c) => c.code === e.target.value,
                )
                if (selected) onCurrencyChange(selected)
              }}
              className="bg-transparent border-none text-white/70 text-lg font-semibold focus:outline-none focus:ring-0 cursor-pointer appearance-none pr-0"
            >
              {currencies.map((c) => (
                <option
                  key={c.code}
                  value={c.code}
                  className="bg-blue-800 text-white"
                >
                  {c.code}
                </option>
              ))}
            </select>
          )}
          {summary.totalGainOnDay !== 0 && !hideValues && (
            <span
              className={`text-lg font-semibold tabular-nums ${summary.totalGainOnDay >= 0 ? "text-emerald-300" : "text-red-300"}`}
            >
              {summary.totalGainOnDay >= 0 ? "+" : ""}
              {displayCurrency?.symbol}
              <FormatValue value={summary.totalGainOnDay} />
              <span className="text-sm ml-1 text-white/60 font-normal">
                today
              </span>
            </span>
          )}
        </div>
        <p className="text-white/70 text-sm mt-1">
          Across {summary.portfolioCount} portfolio
          {summary.portfolioCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Liquidity bar — inline in hero */}
      {summary.classificationBreakdown.length > 0 && (
        <div className="px-8 pt-4 pb-6">
          <div className="flex h-3 rounded-full overflow-hidden bg-white/25 mb-3">
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
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {summary.classificationBreakdown.map((item) => (
              <div
                key={item.classification}
                className="flex items-center gap-2"
              >
                <div
                  className="w-3 h-3 rounded-full ring-2 ring-white/50"
                  style={{
                    backgroundColor:
                      LIQUIDITY_COLORS[item.classification] || "#6B7280",
                  }}
                />
                <span className="text-sm text-white/80">
                  {item.classification}
                </span>
                <span className="text-sm font-semibold text-white tabular-nums">
                  {item.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation links */}
      <div className="flex items-center gap-1 px-8 pb-5">
        <Link
          href="/portfolios"
          className="text-sky-300 hover:text-sky-200 hover:bg-white/15 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
          title="Portfolios"
        >
          <i className="fas fa-chart-pie text-sm text-white"></i>
          <span className="text-xs font-medium hidden sm:inline">
            Portfolios
          </span>
        </Link>
        <Link
          href="/rebalance/wizard"
          className="text-emerald-300 hover:text-emerald-200 hover:bg-white/15 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
          title="Strategy"
        >
          <i className="fas fa-chess text-sm text-emerald-300"></i>
          <span className="text-xs font-medium hidden sm:inline">Strategy</span>
        </Link>
        <Link
          href="/independence"
          className="text-orange-300 hover:text-orange-200 hover:bg-white/15 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
          title="Independence"
        >
          <i className="fas fa-umbrella-beach text-sm text-orange-300"></i>
          <span className="text-xs font-medium hidden sm:inline">
            Independence
          </span>
        </Link>
        {portfolios.length > 0 && (
          <button
            onClick={onShareClick}
            className="text-white/70 hover:text-white hover:bg-white/15 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            title={t("shares.invite.title")}
          >
            <i className="fas fa-share-alt text-sm"></i>
            <span className="text-xs font-medium hidden sm:inline">
              {t("share")}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

export default WealthHeroSection
