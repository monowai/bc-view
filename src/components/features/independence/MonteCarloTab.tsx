import React, { useState } from "react"
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { RetirementPlan, RetirementProjection } from "types/independence"
import { WhatIfAdjustments, ScenarioOverrides } from "./types"
import { AssetBreakdown } from "./useAssetBreakdown"
import { RentalIncomeData } from "./useUnifiedProjection"
import { useMonteCarloSimulation } from "./useMonteCarloSimulation"

const HIDDEN_VALUE = "****"

interface MonteCarloTabProps {
  plan: RetirementPlan
  assets: AssetBreakdown
  currentAge?: number
  retirementAge?: number
  lifeExpectancy?: number
  monthlyInvestment?: number
  whatIfAdjustments: WhatIfAdjustments
  scenarioOverrides: ScenarioOverrides
  rentalIncome?: RentalIncomeData
  displayCurrency?: string
  hideValues: boolean
  currency: string
  displayProjection: RetirementProjection | null
}

const ITERATION_OPTIONS = [500, 1000, 2000, 5000]

function successRateColor(rate: number): string {
  if (rate >= 80) return "text-green-600"
  if (rate >= 50) return "text-amber-600"
  return "text-red-600"
}

function successRateBg(rate: number): string {
  if (rate >= 80) return "bg-green-50 border-green-200"
  if (rate >= 50) return "bg-amber-50 border-amber-200"
  return "bg-red-50 border-red-200"
}

export default function MonteCarloTab({
  plan,
  assets,
  currentAge,
  retirementAge,
  lifeExpectancy,
  monthlyInvestment,
  whatIfAdjustments,
  scenarioOverrides,
  rentalIncome,
  displayCurrency,
  hideValues,
  currency,
  displayProjection,
}: MonteCarloTabProps): React.ReactElement {
  const [iterations, setIterations] = useState(1000)
  const [fanTooltipEnabled, setFanTooltipEnabled] = useState(true)

  const { result, isRunning, error, runSimulation } = useMonteCarloSimulation({
    plan,
    assets,
    currentAge,
    retirementAge,
    lifeExpectancy,
    monthlyInvestment,
    whatIfAdjustments,
    scenarioOverrides,
    rentalIncome,
    displayCurrency,
  })

  // Build fan chart data from yearly bands + deterministic overlay
  const fanChartData = result
    ? result.yearlyBands.map((band) => {
        const deterministicYear = displayProjection?.yearlyProjections?.find(
          (y) => y.year === band.year,
        )
        return {
          age: band.age ?? band.year,
          year: band.year,
          p5: band.p5,
          p10: band.p10,
          p25: band.p25,
          p50: band.p50,
          p75: band.p75,
          p90: band.p90,
          p95: band.p95,
          deterministic: deterministicYear?.endingBalance ?? null,
        }
      })
    : []

  // Build depletion histogram data with cumulative percentages
  const histogramData = (() => {
    if (!result) return []
    const sorted = Object.entries(result.depletionAgeDistribution.histogram)
      .map(([age, count]) => ({ age: Number(age), count }))
      .sort((a, b) => a.age - b.age)
    const depletedCount = result.depletionAgeDistribution.depletedCount
    const totalIterations = result.iterations
    let cumulative = 0
    return sorted.map((entry) => {
      cumulative += entry.count
      return {
        ...entry,
        pctOfTotal: (entry.count / totalIterations) * 100,
        pctOfDepleted:
          depletedCount > 0 ? (entry.count / depletedCount) * 100 : 0,
        cumulativeCount: cumulative,
        cumulativePctOfDepleted:
          depletedCount > 0 ? (cumulative / depletedCount) * 100 : 0,
      }
    })
  })()

  const formatFullCurrency = (value: number): string => {
    if (hideValues) return HIDDEN_VALUE
    return `${currency}${Math.round(value).toLocaleString()}`
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Monte Carlo Simulation
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Randomise returns and inflation to estimate the probability your
              plan survives the full planning horizon.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <select
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              disabled={isRunning}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            >
              {ITERATION_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString()} iterations
                </option>
              ))}
            </select>
            <button
              onClick={() => runSimulation(iterations)}
              disabled={isRunning}
              className="px-4 py-2 bg-independence-500 hover:bg-independence-600 disabled:bg-independence-200 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Running...
                </>
              ) : (
                <>
                  <i className="fas fa-play"></i>
                  Run Simulation
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <i className="fas fa-exclamation-circle mr-2"></i>
            {error.message}
          </div>
        )}
      </div>

      {/* Results */}
      {!result && !isRunning && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="text-center py-12 text-gray-500">
            <i className="fas fa-dice text-4xl mb-3 text-gray-300"></i>
            <p>Click &quot;Run Simulation&quot; to see results</p>
          </div>
        </div>
      )}

      {result && (
        <>
          {/* Success Rate */}
          <div
            className={`rounded-xl shadow-md p-6 border ${successRateBg(result.successRate)}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">
                  Success Rate
                </div>
                <div
                  className={`text-4xl font-bold ${successRateColor(result.successRate)}`}
                >
                  {hideValues
                    ? HIDDEN_VALUE
                    : `${result.successRate.toFixed(1)}%`}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {hideValues
                    ? HIDDEN_VALUE
                    : `${result.depletionAgeDistribution.survivedCount.toLocaleString()} of ${result.iterations.toLocaleString()} iterations survived the full planning horizon`}
                </div>
              </div>
              <div className="text-right text-sm text-gray-500">
                <div>
                  Deterministic runway:{" "}
                  {hideValues
                    ? HIDDEN_VALUE
                    : `${result.deterministicRunwayYears} years`}
                </div>
                {result.deterministicDepletionAge && (
                  <div>
                    Deterministic depletion age:{" "}
                    {hideValues
                      ? HIDDEN_VALUE
                      : result.deterministicDepletionAge}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fan Chart */}
          {fanChartData.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Projected Balance Range
                </h3>
                <button
                  type="button"
                  onClick={() => setFanTooltipEnabled((v) => !v)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    fanTooltipEnabled
                      ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      : "bg-independence-100 text-independence-700 hover:bg-independence-200"
                  }`}
                  title={fanTooltipEnabled ? "Hide tooltip" : "Show tooltip"}
                >
                  <i
                    className={`fas ${fanTooltipEnabled ? "fa-eye-slash" : "fa-eye"} mr-1`}
                  ></i>
                  Tooltip
                </button>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={fanChartData}
                    margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="age"
                      label={{
                        value: "Age",
                        position: "insideBottom",
                        offset: -10,
                      }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      tickFormatter={(value) =>
                        hideValues
                          ? HIDDEN_VALUE
                          : `${currency}${(value / 1000).toFixed(0)}k`
                      }
                      tick={{ fontSize: 12 }}
                    />
                    {fanTooltipEnabled && (
                      <ChartTooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          // Hide tooltip when p50, p75, and p95 are all 0
                          const p50 = payload.find(
                            (p) => p.dataKey === "p50",
                          )?.value
                          const p75 = payload.find(
                            (p) => p.dataKey === "p75",
                          )?.value
                          const p95 = payload.find(
                            (p) => p.dataKey === "p95",
                          )?.value
                          if (
                            Number(p50 ?? 0) === 0 &&
                            Number(p75 ?? 0) === 0 &&
                            Number(p95 ?? 0) === 0
                          ) {
                            return null
                          }
                          const labels: Record<string, string> = {
                            p95: "95th percentile",
                            p90: "90th percentile",
                            p75: "75th percentile",
                            p50: "Median",
                            p25: "25th percentile",
                            p10: "10th percentile",
                            p5: "5th percentile",
                            deterministic: "Deterministic",
                          }
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-xs">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-gray-700">
                                  Age {label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setFanTooltipEnabled(false)}
                                  className="text-gray-400 hover:text-gray-600 ml-3 -mr-1"
                                  title="Close tooltip"
                                >
                                  <i className="fas fa-times"></i>
                                </button>
                              </div>
                              <div className="space-y-1">
                                {payload
                                  .filter((p) => p.value != null)
                                  .map((p) => {
                                    const key = String(p.dataKey ?? "")
                                    const isDeterministic =
                                      key === "deterministic"
                                    return (
                                      <div
                                        key={key}
                                        className="flex justify-between gap-3"
                                      >
                                        <span
                                          className={
                                            isDeterministic
                                              ? "text-blue-600"
                                              : "text-gray-600"
                                          }
                                        >
                                          {labels[key] ?? key}
                                        </span>
                                        <span
                                          className={`font-medium ${isDeterministic ? "text-blue-700" : "text-gray-900"}`}
                                        >
                                          {formatFullCurrency(
                                            Number(p.value ?? 0),
                                          )}
                                        </span>
                                      </div>
                                    )
                                  })}
                              </div>
                            </div>
                          )
                        }}
                      />
                    )}
                    <Legend
                      formatter={(value: string) => {
                        const labels: Record<string, string> = {
                          p95: "p5-p95 Band",
                          p75: "p25-p75 Band",
                          p50: "Median (p50)",
                          deterministic: "Deterministic",
                        }
                        return labels[value] ?? value
                      }}
                    />
                    {/* Outer band: p5-p95 */}
                    <Area
                      dataKey="p95"
                      stroke="none"
                      fill="#fdba74"
                      fillOpacity={0.3}
                      name="p95"
                    />
                    <Area
                      dataKey="p5"
                      stroke="none"
                      fill="#ffffff"
                      fillOpacity={1}
                      name="p5"
                      legendType="none"
                    />
                    {/* Inner band: p25-p75 */}
                    <Area
                      dataKey="p75"
                      stroke="none"
                      fill="#f97316"
                      fillOpacity={0.3}
                      name="p75"
                    />
                    <Area
                      dataKey="p25"
                      stroke="none"
                      fill="#ffffff"
                      fillOpacity={1}
                      name="p25"
                      legendType="none"
                    />
                    {/* Median line */}
                    <Line
                      type="monotone"
                      dataKey="p50"
                      stroke="#ea580c"
                      strokeWidth={2}
                      dot={false}
                      name="p50"
                    />
                    {/* Deterministic overlay */}
                    <Line
                      type="monotone"
                      dataKey="deterministic"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                      name="deterministic"
                      connectNulls={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Summary Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Terminal Balance Percentiles */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Terminal Balance Percentiles
              </h3>
              <div className="space-y-2 text-sm">
                {(
                  [
                    ["p95", result.terminalBalancePercentiles.p95],
                    ["p75", result.terminalBalancePercentiles.p75],
                    ["p50", result.terminalBalancePercentiles.p50],
                    ["p25", result.terminalBalancePercentiles.p25],
                    ["p5", result.terminalBalancePercentiles.p5],
                  ] as [string, number][]
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between items-center"
                  >
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium text-gray-900">
                      {formatFullCurrency(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Depletion Distribution */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Depletion Distribution
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Survived</span>
                  <span className="font-medium text-green-600">
                    {hideValues
                      ? HIDDEN_VALUE
                      : result.depletionAgeDistribution.survivedCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Depleted</span>
                  <span className="font-medium text-red-600">
                    {hideValues
                      ? HIDDEN_VALUE
                      : result.depletionAgeDistribution.depletedCount.toLocaleString()}
                  </span>
                </div>
                {result.depletionAgeDistribution.earliestDepletionAge && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">
                      Earliest depletion age
                    </span>
                    <span className="font-medium text-gray-900">
                      {hideValues
                        ? HIDDEN_VALUE
                        : result.depletionAgeDistribution.earliestDepletionAge}
                    </span>
                  </div>
                )}
                {result.depletionAgeDistribution.mostCommonDepletionAge && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">
                      Most common depletion age
                    </span>
                    <span className="font-medium text-gray-900">
                      {hideValues
                        ? HIDDEN_VALUE
                        : result.depletionAgeDistribution
                            .mostCommonDepletionAge}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Parameters Used */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Simulation Parameters
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Blended return</span>
                  <span className="font-medium text-gray-900">
                    {(result.parameters.blendedReturnRate * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Blended volatility</span>
                  <span className="font-medium text-gray-900">
                    {(result.parameters.blendedVolatility * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Inflation</span>
                  <span className="font-medium text-gray-900">
                    {(result.parameters.inflationRate * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Inflation vol</span>
                  <span className="font-medium text-gray-900">
                    {(result.parameters.inflationVolatility * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Iterations</span>
                  <span className="font-medium text-gray-900">
                    {result.iterations.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Depletion Age Histogram */}
          {result.depletionAgeDistribution.depletedCount > 0 &&
            histogramData.length > 0 && (
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Depletion Age Distribution
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={histogramData}
                      margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="age"
                        label={{
                          value: "Age",
                          position: "insideBottom",
                          offset: -10,
                        }}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        label={{
                          value: "Iterations",
                          angle: -90,
                          position: "insideLeft",
                          offset: -5,
                        }}
                      />
                      <ChartTooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const entry = histogramData.find(
                            (d) => d.age === Number(label),
                          )
                          if (!entry) return null
                          if (hideValues) {
                            return (
                              <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                                <div className="font-semibold text-gray-700 mb-1">
                                  Age {label}
                                </div>
                                <div>{HIDDEN_VALUE}</div>
                              </div>
                            )
                          }
                          // Find depleted path summaries for this age
                          const paths =
                            result?.depletionAgeDistribution.depletedPaths?.filter(
                              (p) => p.depletionAge === Number(label),
                            ) || []
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-xs">
                              <div className="font-semibold text-gray-700 mb-2">
                                Depleted at age {label}
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600">
                                    Iterations
                                  </span>
                                  <span className="font-medium text-red-700">
                                    {entry.count.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600">
                                    % of all iterations
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    {entry.pctOfTotal.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600">
                                    % of depleted
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    {entry.pctOfDepleted.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="border-t border-gray-100 pt-1 mt-1 flex justify-between gap-4">
                                  <span className="text-gray-600">
                                    Cumulative by age {label}
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    {entry.cumulativeCount.toLocaleString()} (
                                    {entry.cumulativePctOfDepleted.toFixed(0)}%)
                                  </span>
                                </div>
                              </div>
                              {/* Realized return details for depleted paths at this age */}
                              {paths.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <div className="font-semibold text-gray-600 mb-1">
                                    Realized returns (
                                    {paths.length === 1
                                      ? "1 path"
                                      : `avg of ${paths.length} paths`}
                                    )
                                  </div>
                                  {(() => {
                                    const avgReturn =
                                      paths.reduce(
                                        (s, p) => s + p.averageReturn,
                                        0,
                                      ) / paths.length
                                    const worstReturn = Math.min(
                                      ...paths.map((p) => p.worstReturn),
                                    )
                                    const avgInflation =
                                      paths.reduce(
                                        (s, p) => s + p.averageInflation,
                                        0,
                                      ) / paths.length
                                    const worstInflation = Math.max(
                                      ...paths.map((p) => p.worstInflation),
                                    )
                                    return (
                                      <div className="space-y-1">
                                        <div className="flex justify-between gap-4">
                                          <span className="text-gray-600">
                                            Avg return p.a.
                                          </span>
                                          <span className="font-medium text-gray-900">
                                            {(avgReturn * 100).toFixed(2)}%
                                          </span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                          <span className="text-gray-600">
                                            Worst year return
                                          </span>
                                          <span className="font-medium text-red-700">
                                            {(worstReturn * 100).toFixed(2)}%
                                          </span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                          <span className="text-gray-600">
                                            Avg inflation p.a.
                                          </span>
                                          <span className="font-medium text-gray-900">
                                            {(avgInflation * 100).toFixed(2)}%
                                          </span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                          <span className="text-gray-600">
                                            Worst year inflation
                                          </span>
                                          <span className="font-medium text-red-700">
                                            {(worstInflation * 100).toFixed(2)}%
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                </div>
                              )}
                              {paths.length === 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-100 text-gray-500">
                                  Worst-case return sequences depleted funds by
                                  this age
                                </div>
                              )}
                            </div>
                          )
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#ef4444"
                        fillOpacity={0.7}
                        name="Depleted"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
        </>
      )}
    </div>
  )
}
