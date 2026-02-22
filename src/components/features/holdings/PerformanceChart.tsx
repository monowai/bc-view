import React, { useState, useMemo } from "react"
import useSwr from "swr"
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

type ChartTab = "gain" | "income"

interface PerformanceChartProps {
  portfolioCode: string
  currencySymbol?: string
  portfolioIrr?: number
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({
  portfolioCode,
  currencySymbol = "$",
  portfolioIrr,
}) => {
  const [months, setMonths] = useState(12)
  const [activeChart, setActiveChart] = useState<ChartTab>("gain")

  const apiUrl = `/api/performance/${portfolioCode}?months=${months}`
  const { data, isLoading, error } = useSwr<PerformanceResponse>(
    apiUrl,
    simpleFetcher(apiUrl),
  )

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

  const showIrr = portfolioIrr !== undefined && portfolioIrr !== 0
  const irrPositive = (portfolioIrr ?? 0) >= 0

  // Compute investment gain for each data point
  const gainSeries = useMemo(
    () =>
      series.map((point) => ({
        ...point,
        investmentGain: point.marketValue - point.netContributions,
      })),
    [series],
  )

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
  const gainStats = useMemo(() => {
    if (series.length === 0) return null
    const last = series[series.length - 1]
    const gain = last.marketValue - last.netContributions
    return {
      gain,
      marketValue: last.marketValue,
      contributed: last.netContributions,
      cumulativeDividends: last.cumulativeDividends,
    }
  }, [series])

  const hasDividends = (gainStats?.cumulativeDividends ?? 0) > 0

  // Annualized dividend yield: (dividends / marketValue) * (12 / months)
  const dividendYield = useMemo(() => {
    if (!hasDividends || !gainStats || gainStats.marketValue === 0) return null
    return (
      (gainStats.cumulativeDividends / gainStats.marketValue) *
      (12 / months) *
      100
    )
  }, [hasDividends, gainStats, months])

  // Format helpers using shared functions with currency symbol
  const formatCompact = (value: number): string =>
    formatCompactShared(value, sym)

  const formatFull = (value: number): string => formatFullShared(value, sym)

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
        <div className="flex items-center px-4 py-2 border-b border-gray-100">
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
          <div
            className={`grid ${showIrr ? "grid-cols-4" : "grid-cols-3"} divide-x divide-gray-100 px-2 py-4`}
          >
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
                {sym}1,000 &rarr; {sym}
                {growthStats.current.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>

            {/* Portfolio Value */}
            <div className="px-4">
              <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                Portfolio Value
              </div>
              <div className="text-2xl font-mono font-bold tracking-tight text-gray-900">
                {formatCompact(gainStats.marketValue)}
              </div>
              <div className="text-xs text-gray-400 font-mono mt-0.5">
                {formatCompact(gainStats.contributed)} contributed
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
                {formatCompact(gainStats.gain)}
              </div>
              <div className="text-xs text-gray-400 font-mono mt-0.5">
                {gainStats.cumulativeDividends > 0 && dividendYield
                  ? `incl. ${formatCompact(gainStats.cumulativeDividends)} dividends (${dividendYield.toFixed(1)}% yield)`
                  : gainStats.contributed !== 0
                    ? `${((gainStats.gain / Math.abs(gainStats.contributed)) * 100).toFixed(1)}% on cost`
                    : "\u00A0"}
              </div>
            </div>

            {/* Your IRR */}
            {showIrr && (
              <div className="px-4">
                <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Your IRR
                </div>
                <div
                  className={`text-2xl font-mono font-bold tracking-tight ${irrPositive ? "text-gain" : "text-loss"}`}
                >
                  {irrPositive ? "+" : ""}
                  {(portfolioIrr ?? 0).toFixed(2)}%
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Your personal return
                </div>
              </div>
            )}
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
            aria-selected={activeChart === "income"}
            onClick={() => setActiveChart("income")}
            className={`relative px-3 py-2.5 text-xs font-medium transition-colors ${
              activeChart === "income"
                ? "text-gray-900"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Income
            {activeChart === "income" && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-invest-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Chart area */}
        <div className="p-4">
          <div className="h-72">
            {activeChart === "gain" ? (
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
                    formatter={(value) => [formatFull(Number(value)), "Gain"]}
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
            ) : hasDividends ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
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
                    domain={[0, "auto"]}
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
                      formatFull(Number(value)),
                      "Dividends",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativeDividends"
                    stroke={CHART_COLORS.accent}
                    strokeWidth={2}
                    fill="url(#incomeFill)"
                    dot={false}
                    activeDot={ACTIVE_DOT}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No dividend income recorded for this period
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PerformanceChart
