import React from "react"
import { MonteCarloResult, RetirementProjection } from "types/independence"
import { FanChart } from "./FanChart"
import { DepletionHistogram } from "./DepletionHistogram"
import { PercentileTable } from "./PercentileTable"

interface MonteCarloResultViewProps {
  result: MonteCarloResult
  deterministicProjection?: RetirementProjection
  currency: string
  /**

* When true, dollar values are masked. Percentages, counts, ages and years
* remain visible — privacy mode hides money, not the shape of the result.
   */
  hideValues: boolean
}

const HIDDEN_VALUE = "****"

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

export function MonteCarloResultView({
  result,
  deterministicProjection,
  currency,
  hideValues,
}: MonteCarloResultViewProps): React.ReactElement {
  return (
    <>
      {/*Success Rate*/}
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
              {result.successRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {result.depletionAgeDistribution.survivedCount.toLocaleString()}{" "}
              of {result.iterations.toLocaleString()} iterations survived the
              full planning horizon
            </div>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div>
              Deterministic runway: {result.deterministicRunwayYears} years
            </div>
            {result.deterministicDepletionAge && (
              <div>
                Deterministic depletion age: {result.deterministicDepletionAge}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fan Chart */}
      <FanChart
        yearlyBands={result.yearlyBands}
        deterministicProjection={deterministicProjection}
        medianLiquidationAge={result.medianLiquidationAge}
        currency={currency}
        hideValues={hideValues}
      />

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Terminal Balance Percentiles */}
        <PercentileTable
          percentiles={result.terminalBalancePercentiles}
          currency={currency}
          hideValues={hideValues}
        />

        {/* Illiquid Assets */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            <i className="fas fa-home text-purple-500 mr-2"></i>
            Illiquid Assets
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span
                className="text-gray-600 cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2"
                title="Current value of illiquid assets (e.g. property) that may be sold if liquid runs low"
              >
                Start value
              </span>
              <span
                className={`font-medium ${hideValues ? "text-gray-400" : "text-gray-900"}`}
              >
                {hideValues
                  ? HIDDEN_VALUE
                  : `${currency}${Math.round(result.nonSpendableAtStart).toLocaleString()}`}
              </span>
            </div>
            {result.nonSpendableAtStart > 0 ? (
              <>
                {(() => {
                  const soldPct =
                    result.iterations > 0
                      ? (result.liquidatedCount / result.iterations) * 100
                      : 0
                  const neverSoldCount =
                    result.iterations - result.liquidatedCount
                  return (
                    <>
                      <div className="flex justify-between items-center">
                        <span
                          className="text-gray-600 cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2"
                          title="Share of stress scenarios that liquidated illiquid assets before horizon end"
                        >
                          Sold
                        </span>
                        <span className="font-medium text-gray-900">
                          {soldPct.toFixed(1)}% (
                          {result.liquidatedCount.toLocaleString()}/
                          {result.iterations.toLocaleString()})
                        </span>
                      </div>
                      {result.medianLiquidationAge && (
                        <div className="flex justify-between items-center">
                          <span
                            className="text-gray-600 cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2"
                            title={`Median age among the ${result.liquidatedCount.toLocaleString()} scenarios that sold; ${neverSoldCount.toLocaleString()} never needed to`}
                          >
                            Median sale age
                          </span>
                          <span className="font-medium text-purple-600">
                            {result.medianLiquidationAge}
                          </span>
                        </div>
                      )}
                      {result.liquidatedCount === 0 && (
                        <p className="text-xs text-gray-500 italic pt-1">
                          Liquid stayed above sell threshold in every scenario.
                        </p>
                      )}
                    </>
                  )
                })()}
              </>
            ) : (
              <p className="text-xs text-gray-500 italic pt-1">
                No illiquid assets; depletion reflects liquid only.
              </p>
            )}
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
                {result.depletionAgeDistribution.survivedCount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Depleted</span>
              <span className="font-medium text-red-600">
                {result.depletionAgeDistribution.depletedCount.toLocaleString()}
              </span>
            </div>
            {result.depletionAgeDistribution.earliestDepletionAge && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Earliest depletion age</span>
                <span className="font-medium text-gray-900">
                  {result.depletionAgeDistribution.earliestDepletionAge}
                </span>
              </div>
            )}
            {result.depletionAgeDistribution.mostCommonDepletionAge && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Most common depletion age</span>
                <span className="font-medium text-gray-900">
                  {result.depletionAgeDistribution.mostCommonDepletionAge}
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
      />
    </>
  )
}
