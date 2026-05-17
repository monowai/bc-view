import React, { useEffect, useRef, useState } from "react"
import { useCompositeProjectionContext } from "../CompositeProjectionContext"
import useCompositeMonteCarloSimulation from "@hooks/useCompositeMonteCarloSimulation"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { MonteCarloResultView } from "../../monte-carlo/MonteCarloResultView"

const ITERATION_OPTIONS = [500, 1000, 2000, 5000]

/**
 * Composite Stress Test tab.
 *
 * Wires {@link useCompositeMonteCarloSimulation} into
 * {@link MonteCarloResultView}. The run is user-triggered (Monte Carlo is
 * computationally expensive). When phases or display currency change after
 * a run, results are marked stale to prompt the user to re-run.
 */
export default function StressTestTab(): React.ReactElement {
  const { phases, displayCurrency } = useCompositeProjectionContext()
  const { hideValues } = usePrivacyMode()
  const { result, isRunning, error, runSimulation } =
    useCompositeMonteCarloSimulation()
  const [iterations, setIterations] = useState(1000)
  const [isStale, setIsStale] = useState(false)
  const isFirstRender = useRef(true)

  // Mark result stale when user changes phases/currency after a run.
  // Skip the very first render so a result that is already present (e.g.
  // restored from a parent / hook) is not immediately flagged as stale.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (result) setIsStale(true)
    // We intentionally only react to phases/currency changes, not result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phases, displayCurrency])

  const hasPhases = phases.length > 0
  const canRun = hasPhases && !isRunning

  const handleRun = (): void => {
    setIsStale(false)
    void runSimulation({
      iterations,
      phases,
      displayCurrency,
    })
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Composite Stress Test
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Randomise returns and inflation across all phases to estimate the
              probability your composite plan survives the full planning
              horizon.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <select
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              disabled={isRunning}
              aria-label="Iterations"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            >
              {ITERATION_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString()} iterations
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleRun}
              disabled={!canRun}
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
                  Run Stress Test
                </>
              )}
            </button>
          </div>
        </div>

        {isStale && result && (
          <div
            role="status"
            className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700"
          >
            <i className="fas fa-exclamation-triangle mr-2"></i>
            Results are stale &mdash; rerun to see updated stress test
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
          >
            <i className="fas fa-exclamation-circle mr-2"></i>
            {error.message}
          </div>
        )}
      </div>

      {/* Empty / idle states */}
      {!result && !isRunning && !hasPhases && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="text-center py-12 text-gray-500">
            <i className="fas fa-layer-group text-4xl mb-3 text-gray-300"></i>
            <p>Add at least one phase to run a stress test.</p>
          </div>
        </div>
      )}

      {!result && !isRunning && hasPhases && !error && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="text-center py-12 text-gray-500">
            <i className="fas fa-dice text-4xl mb-3 text-gray-300"></i>
            <p>Click &quot;Run Stress Test&quot; to see results</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <MonteCarloResultView
          result={result}
          deterministicProjection={undefined}
          currency={displayCurrency}
          hideValues={hideValues}
        />
      )}
    </div>
  )
}
