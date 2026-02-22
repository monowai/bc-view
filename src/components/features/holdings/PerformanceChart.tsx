import React, { useState, useMemo, useCallback } from "react"
import useSwr, { useSWRConfig } from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { PerformanceResponse } from "types/beancounter"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import {
  TIME_RANGES,
  CHART_COLORS,
  AXIS_TICK,
  ACTIVE_DOT,
  TOOLTIP_STYLE,
  formatCompact as formatCompactShared,
  formatFull as formatFullShared,
  formatAxisDate,
  formatTooltipDate,
} from "@lib/chart/performanceConstants"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { useUserPreferences } from "@contexts/UserPreferencesContext"

type ChartTab = "gain" | "guide"

interface PerformanceChartProps {
  portfolioCode: string
  currencySymbol?: string
}

const HIDDEN = "****"

const PerformanceChart: React.FC<PerformanceChartProps> = ({
  portfolioCode,
  currencySymbol = "$",
}) => {
  const [months, setMonths] = useState(12)
  const [activeChart, setActiveChart] = useState<ChartTab>("gain")
  const [resetState, setResetState] = useState<"idle" | "resetting" | "done">(
    "idle",
  )
  const [backfillState, setBackfillState] = useState<
    "idle" | "loading" | "done"
  >("idle")
  const [backfillSummary, setBackfillSummary] = useState("")
  const { hideValues } = usePrivacyMode()
  const { preferences } = useUserPreferences()
  const { mutate } = useSWRConfig()

  const apiUrl = `/api/performance/${portfolioCode}?months=${months}`
  const { data, isLoading, error } = useSwr<PerformanceResponse>(
    apiUrl,
    simpleFetcher(apiUrl),
  )

  const handleResetCache = useCallback(async () => {
    setResetState("resetting")
    try {
      await fetch(`/api/performance/${portfolioCode}/reset`, {
        method: "DELETE",
      })
      await mutate(apiUrl)
      setResetState("done")
      setTimeout(() => setResetState("idle"), 1500)
    } catch {
      setResetState("idle")
    }
  }, [portfolioCode, apiUrl, mutate])

  const handleBackfill = useCallback(async () => {
    setBackfillState("loading")
    try {
      const res = await fetch(`/api/prices/backfill/${portfolioCode}`, {
        method: "POST",
      })
      const result = await res.json()
      await mutate(apiUrl)
      setBackfillState("done")
      if (result.status === "ok") {
        setBackfillSummary(
          `${result.datesProcessed} dates, ${result.assetsProcessed} assets`,
        )
      }
      setTimeout(() => {
        setBackfillState("idle")
        setBackfillSummary("")
      }, 3000)
    } catch {
      setBackfillState("idle")
    }
  }, [portfolioCode, apiUrl, mutate])

  const series = useMemo(() => data?.data?.series || [], [data?.data?.series])
  const firstTradeDate = data?.data?.firstTradeDate
  const currency = data?.data?.currency
  const sym = currency?.symbol || currencySymbol

  // Determine if the selected range extends before the portfolio's first trade
  const dataCoverageInfo = useMemo(() => {
    if (!firstTradeDate) return null
    const now = new Date()
    const rangeStart = new Date(now)
    rangeStart.setMonth(rangeStart.getMonth() - months)
    const firstDate = new Date(firstTradeDate)
    if (firstDate <= rangeStart) return null
    // Calculate months of actual data
    const diffMs = now.getTime() - firstDate.getTime()
    const diffMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44))
    return { firstTradeDate, months: diffMonths }
  }, [firstTradeDate, months])

  // Compute investment gain and in-window dividends for each data point
  const gainSeries = useMemo(() => {
    if (series.length === 0) return []
    const baseDividends = series[0].cumulativeDividends
    return series.map((point) => ({
      ...point,
      investmentGain: point.marketValue - point.netContributions,
      windowDividends: point.cumulativeDividends - baseDividends,
    }))
  }, [series])

  // Stats for TWR / Growth of $1,000
  const growthStats = useMemo(() => {
    if (series.length === 0) return null
    const last = series[series.length - 1]
    return {
      current: last.growthOf1000,
      returnPct: last.cumulativeReturn * 100,
    }
  }, [series])

  // Stats for Investment Gain and dividends
  // Use in-window dividends (last - first) since cumulativeDividends is since inception
  const gainStats = useMemo(() => {
    if (series.length === 0) return null
    const first = series[0]
    const last = series[series.length - 1]
    const gain = last.marketValue - last.netContributions
    const windowDividends = last.cumulativeDividends - first.cumulativeDividends
    return {
      gain,
      marketValue: last.marketValue,
      contributed: last.netContributions,
      windowDividends,
    }
  }, [series])

  const hasDividends = (gainStats?.windowDividends ?? 0) > 0

  // Annualized dividend yield: (windowDividends / marketValue) * (12 / months)
  const dividendYield = useMemo(() => {
    if (!hasDividends || !gainStats || gainStats.marketValue === 0) return null
    return (
      (gainStats.windowDividends / gainStats.marketValue) * (12 / months) * 100
    )
  }, [hasDividends, gainStats, months])

  // Format helpers using shared functions with currency symbol
  const formatCompact = (value: number): string =>
    formatCompactShared(value, sym)

  const formatFull = (value: number): string => formatFullShared(value, sym)

  const privateCompact = (value: number): string =>
    hideValues ? HIDDEN : formatCompact(value)

  const isPositive = (growthStats?.returnPct ?? 0) >= 0

  const tooltipStyle = TOOLTIP_STYLE

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <div className="text-loss font-medium mb-1">
          Failed to load performance data
        </div>
        <p className="text-sm text-gray-500">
          {error?.message || "Please try again later"}
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-100">
          <div className="flex gap-1.5 mb-4">
            {TIME_RANGES.map((r) => (
              <div
                key={r.label}
                className="h-7 w-10 rounded bg-gray-100 animate-pulse"
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
                <div className="h-8 w-28 rounded bg-gray-100 animate-pulse" />
                <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="p-4">
          <div className="h-64 rounded bg-gray-50 animate-pulse" />
        </div>
      </div>
    )
  }

  if (series.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">
          No performance data available for this period
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Time range + stats */}
      <div className="border-b border-gray-100">
        {/* Time range tabs */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <div className="flex gap-1">
            {TIME_RANGES.map((range) => (
              <button
                key={range.label}
                onClick={() => setMonths(range.months)}
                className={`px-3 py-1 rounded text-xs font-medium tracking-wide transition-colors ${
                  months === range.months
                    ? "bg-wealth-600 text-white"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          {preferences?.enableTwr && (
            <div className="flex items-center gap-1">
              {backfillSummary && (
                <span className="text-[10px] text-gray-400 mr-1">
                  {backfillSummary}
                </span>
              )}
              <button
                onClick={handleBackfill}
                disabled={backfillState === "loading"}
                title="Load historical prices"
                aria-label="Load historical prices"
                className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {backfillState === "loading" ? (
                  <svg
                    className="w-3.5 h-3.5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="opacity-25"
                    />
                    <path
                      d="M4 12a8 8 0 018-8"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : backfillState === "done" ? (
                  <svg
                    className="w-3.5 h-3.5 text-gain"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                    <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                    <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleResetCache}
                disabled={resetState === "resetting"}
                title="Reset performance cache"
                aria-label="Reset performance cache"
                className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {resetState === "resetting" ? (
                  <svg
                    className="w-3.5 h-3.5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="opacity-25"
                    />
                    <path
                      d="M4 12a8 8 0 018-8"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : resetState === "done" ? (
                  <svg
                    className="w-3.5 h-3.5 text-gain"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Data coverage info banner */}
        {dataCoverageInfo && (
          <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
            Portfolio data starts {dataCoverageInfo.firstTradeDate} (
            {dataCoverageInfo.months} months). Showing available history.
          </div>
        )}

        {/* Key metrics row */}
        {growthStats && gainStats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-gray-100 px-2 py-4">
            {/* TWR Return */}
            <div className="px-4">
              <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                TWR Return
              </div>
              <div
                className={`text-2xl font-mono font-bold tracking-tight ${isPositive ? "text-gain" : "text-loss"}`}
              >
                {isPositive ? "+" : ""}
                {growthStats.returnPct.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-400 font-mono mt-0.5">
                {sym}1,000 &rarr;{" "}
                {hideValues
                  ? HIDDEN
                  : `${sym}${growthStats.current.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </div>
            </div>

            {/* Portfolio Value — hidden on mobile */}
            <div className="hidden sm:block px-4">
              <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                Portfolio Value
              </div>
              <div className="text-2xl font-mono font-bold tracking-tight text-gray-900">
                {privateCompact(gainStats.marketValue)}
              </div>
              <div className="text-xs text-gray-400 font-mono mt-0.5">
                {hideValues ? HIDDEN : formatCompact(gainStats.contributed)}{" "}
                contributed
              </div>
            </div>

            {/* Investment Gain */}
            <div className="px-4">
              <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                Investment Gain
              </div>
              <div
                className={`text-2xl font-mono font-bold tracking-tight ${gainStats.gain >= 0 ? "text-gain" : "text-loss"}`}
              >
                {gainStats.gain >= 0 ? "+" : ""}
                {privateCompact(gainStats.gain)}
              </div>
              <div className="text-xs text-gray-400 font-mono mt-0.5">
                {gainStats.windowDividends > 0 && dividendYield
                  ? `incl. ${hideValues ? HIDDEN : formatCompact(gainStats.windowDividends)} dividends (${dividendYield.toFixed(2)}% yield)`
                  : gainStats.contributed !== 0
                    ? `${((gainStats.gain / Math.abs(gainStats.contributed)) * 100).toFixed(1)}% on cost`
                    : "\u00A0"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart tab bar + chart area */}
      <div>
        {/* Chart tabs */}
        <div
          role="tablist"
          className="flex items-center gap-0 px-4 border-b border-gray-100"
        >
          <button
            role="tab"
            aria-selected={activeChart === "gain"}
            onClick={() => setActiveChart("gain")}
            className={`relative px-3 py-2.5 text-xs font-medium transition-colors ${
              activeChart === "gain"
                ? "text-gray-900"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Investment Gain
            {activeChart === "gain" && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-wealth-600 rounded-full" />
            )}
          </button>
          <button
            role="tab"
            aria-selected={activeChart === "guide"}
            onClick={() => setActiveChart("guide")}
            className={`relative px-3 py-2.5 text-xs font-medium transition-colors ${
              activeChart === "guide"
                ? "text-gray-900"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Guide
            {activeChart === "guide" && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-invest-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Chart / Guide area */}
        <div className="p-4">
          {activeChart === "gain" ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={gainSeries}>
                  <defs>
                    <linearGradient id="gainFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={CHART_COLORS.accent}
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="100%"
                        stopColor={CHART_COLORS.accent}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={AXIS_TICK}
                    tickFormatter={formatAxisDate}
                    interval="preserveStartEnd"
                    dy={4}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    axisLine={false}
                    tickLine={false}
                    tick={AXIS_TICK}
                    tickFormatter={formatCompact}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(label) => formatTooltipDate(String(label))}
                    formatter={(value) => [
                      hideValues ? HIDDEN : formatFull(Number(value)),
                      "Gain",
                    ]}
                  />
                  <ReferenceLine
                    y={0}
                    stroke={CHART_COLORS.axis}
                    strokeDasharray="2 4"
                    label={{
                      value: "Break-even",
                      position: "insideTopLeft",
                      fill: CHART_COLORS.axis,
                      fontSize: 10,
                      fontFamily: "var(--font-dm-sans)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="investmentGain"
                    stroke={CHART_COLORS.accent}
                    strokeWidth={2}
                    fill="url(#gainFill)"
                    dot={false}
                    activeDot={ACTIVE_DOT}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div
              className="grid gap-4 sm:grid-cols-2 text-xs text-gray-600 leading-relaxed"
              data-testid="performance-guide"
            >
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">
                  TWR Return (Time-Weighted Return)
                </h4>
                <p>
                  Measures how well the portfolio&apos;s investments performed,
                  independent of when you added or withdrew money. It eliminates
                  the effect of cash flow timing, making it ideal for comparing
                  your portfolio against benchmarks or other managers.
                </p>
                <p className="mt-1.5 text-gray-500">
                  Growth of {sym}1,000 shows what a hypothetical {sym}1,000
                  invested at the start of the period would be worth today.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">
                  XIRR (Personal Rate of Return)
                </h4>
                <p>
                  Shown per holding in the table as &ldquo;IRR&rdquo;, this is
                  the annualised return that accounts for every deposit,
                  withdrawal, and dividend you actually received. Unlike TWR, it
                  reflects <em>your</em> experience&mdash;including the timing
                  and size of your contributions.
                </p>
                <p className="mt-1.5 text-gray-500">
                  A positive XIRR means your money grew faster than it would in
                  a zero-interest account; a negative value means it shrank.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">
                  Investment Gain
                </h4>
                <p>
                  The difference between the current market value and your net
                  contributions (total invested minus any withdrawals). This is
                  the simple profit or loss in dollar terms.
                </p>
                <p className="mt-1.5 text-gray-500">
                  The chart above plots this value over time so you can see how
                  your gain has trended.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">
                  Contributions &amp; Dividends
                </h4>
                <p>
                  <strong>Net contributions</strong> are the total you&apos;ve
                  put in minus anything you&apos;ve taken out.{" "}
                  <strong>Dividends</strong> are cash payments from your
                  holdings and are included in the gain calculation. The
                  annualised yield shown is based on dividends received during
                  the selected period.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PerformanceChart
