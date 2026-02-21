import React, { useState, useMemo } from "react"
import { Portfolio, Currency } from "types/beancounter"
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
  formatCompact,
  formatFull,
  formatAxisDate,
  formatTooltipDate,
} from "@lib/chart/performanceConstants"
import { useAggregatedPerformance } from "@hooks/useAggregatedPerformance"

interface WealthPerformanceChartProps {
  portfolios: Portfolio[]
  fxRates: Record<string, number>
  displayCurrency: Currency | null
  collapsed: boolean
  onToggle: () => void
}

const WealthPerformanceChart: React.FC<WealthPerformanceChartProps> = ({
  portfolios,
  fxRates,
  displayCurrency,
  collapsed,
  onToggle,
}) => {
  const [months, setMonths] = useState(12)
  const sym = displayCurrency?.symbol || "$"

  const { series, isLoading, error } = useAggregatedPerformance(
    portfolios,
    months,
    fxRates,
    displayCurrency?.code ?? null,
    !collapsed,
  )

  // Compute stats from the last data point
  const stats = useMemo(() => {
    if (series.length === 0) return null
    const last = series[series.length - 1]
    return {
      returnPct: last.cumulativeReturn * 100,
      growthOf1000: last.growthOf1000,
      marketValue: last.marketValue,
      contributed: last.netContributions,
      gain: last.investmentGain,
    }
  }, [series])

  const isPositive = (stats?.returnPct ?? 0) >= 0
  const fmtCompact = (v: number): string => formatCompact(v, sym)
  const fmtFull = (v: number): string => formatFull(v, sym)

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-8">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center text-lg font-semibold text-gray-900 hover:text-gray-700 mb-4"
      >
        <i
          className={`fas fa-chevron-${collapsed ? "right" : "down"} text-gray-400 mr-2 w-4`}
        ></i>
        <i className="fas fa-chart-line text-gray-400 mr-2"></i>
        Wealth Performance
      </button>

      {!collapsed && (
        <>
          {/* Time range tabs */}
          <div className="flex items-center mb-4">
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

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
              <div className="text-loss font-medium mb-1">
                Failed to load performance data
              </div>
              <p className="text-sm text-gray-500">Please try again later</p>
            </div>
          )}

          {isLoading && (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
                    <div className="h-8 w-28 rounded bg-gray-100 animate-pulse" />
                    <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="h-64 rounded bg-gray-50 animate-pulse" />
            </div>
          )}

          {!isLoading && !error && series.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
              <p className="text-gray-500">
                No performance data available for this period
              </p>
            </div>
          )}

          {!isLoading && !error && series.length > 0 && stats && (
            <>
              {/* Key metrics row */}
              <div className="grid grid-cols-3 divide-x divide-gray-100 mb-4 py-4 border-y border-gray-100">
                {/* Aggregate TWR Return */}
                <div className="px-4">
                  <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                    Aggregate TWR
                  </div>
                  <div
                    className={`text-2xl font-mono font-bold tracking-tight ${isPositive ? "text-gain" : "text-loss"}`}
                  >
                    {isPositive ? "+" : ""}
                    {stats.returnPct.toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">
                    {sym}1,000 &rarr; {sym}
                    {stats.growthOf1000.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>

                {/* Total Value */}
                <div className="px-4">
                  <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                    Total Value
                  </div>
                  <div className="text-2xl font-mono font-bold tracking-tight text-gray-900">
                    {fmtCompact(stats.marketValue)}
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">
                    {fmtCompact(stats.contributed)} contributed
                  </div>
                </div>

                {/* Investment Gain */}
                <div className="px-4">
                  <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                    Investment Gain
                  </div>
                  <div
                    className={`text-2xl font-mono font-bold tracking-tight ${stats.gain >= 0 ? "text-gain" : "text-loss"}`}
                  >
                    {stats.gain >= 0 ? "+" : ""}
                    {fmtCompact(stats.gain)}
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">
                    {stats.contributed !== 0
                      ? `${((stats.gain / Math.abs(stats.contributed)) * 100).toFixed(1)}% on cost`
                      : "\u00A0"}
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient
                        id="wealthGainFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
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
                      tickFormatter={fmtCompact}
                      width={55}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelFormatter={(label) =>
                        formatTooltipDate(String(label))
                      }
                      formatter={(value) => [fmtFull(Number(value)), "Gain"]}
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
                      fill="url(#wealthGainFill)"
                      dot={false}
                      activeDot={ACTIVE_DOT}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default WealthPerformanceChart
