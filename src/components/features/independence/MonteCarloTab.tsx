import React, { useState } from "react"
import { RetirementPlan, RetirementProjection } from "types/independence"
import { WhatIfAdjustments, ScenarioOverrides } from "./types"
import { AssetBreakdown } from "./useAssetBreakdown"
import { RentalIncomeData } from "./useUnifiedProjection"
import { useMonteCarloSimulation } from "./useMonteCarloSimulation"
import { FanChart } from "./monte-carlo/FanChart"
import { DepletionHistogram } from "./monte-carlo/DepletionHistogram"
import { PercentileTable } from "./monte-carlo/PercentileTable"

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
          <FanChart
            yearlyBands={result.yearlyBands}
            deterministicProjection={displayProjection ?? undefined}
            currency={currency}
            hideValues={hideValues}
          />

          {/* Summary Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Terminal Balance Percentiles */}
            <PercentileTable
              percentiles={result.terminalBalancePercentiles}
              currency={currency}
              hideValues={hideValues}
            />

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
          <DepletionHistogram
            distribution={result.depletionAgeDistribution}
            iterations={result.iterations}
            hideValues={hideValues}
          />
        </>
      )}
    </div>
  )
}
