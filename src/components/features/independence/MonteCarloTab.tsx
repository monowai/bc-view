import React, { useState } from "react"
import { RetirementPlan, RetirementProjection } from "types/independence"
import type { ScenarioState } from "./scenario/types"
import { AssetBreakdown } from "./useAssetBreakdown"
import { RentalIncomeData } from "./useUnifiedProjection"
import { useMonteCarloSimulation } from "./useMonteCarloSimulation"
import { MonteCarloResultView } from "./monte-carlo/MonteCarloResultView"

interface MonteCarloTabProps {
  plan: RetirementPlan
  assets: AssetBreakdown
  monthlyInvestment?: number
  /** Same scenario state that drives the deterministic projection. */
  scenario: ScenarioState
  rentalIncome?: RentalIncomeData
  displayCurrency?: string
  hideValues: boolean
  currency: string
  displayProjection: RetirementProjection | null
}

const ITERATION_OPTIONS = [500, 1000, 2000, 5000]

export default function MonteCarloTab({
  plan,
  assets,
  monthlyInvestment,
  scenario,
  rentalIncome,
  displayCurrency,
  hideValues,
  currency,
  displayProjection,
}: MonteCarloTabProps): React.ReactElement {
  const [iterations, setIterations] = useState(1000)
  const [neverSellIlliquid, setNeverSellIlliquid] = useState(false)

  const { result, isRunning, error, runSimulation } = useMonteCarloSimulation({
    plan,
    assets,
    monthlyInvestment,
    scenario,
    rentalIncome,
    displayCurrency,
    neverSellIlliquid,
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

        {/* Stress-run modelling assumption */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={neverSellIlliquid}
              onChange={(e) => setNeverSellIlliquid(e.target.checked)}
              disabled={isRunning}
              aria-label="Never force-sell illiquid"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-independence-500 focus:ring-independence-500"
            />
            <span>
              <span className="text-sm font-medium text-gray-800">
                Never force-sell illiquid assets
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">
                Keeps your property &amp; real-estate in place — models spending
                from liquid savings only (CPF is already excluded)
              </span>
            </span>
          </label>
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
        <MonteCarloResultView
          result={result}
          deterministicProjection={displayProjection ?? undefined}
          currency={currency}
          hideValues={hideValues}
        />
      )}
    </div>
  )
}
