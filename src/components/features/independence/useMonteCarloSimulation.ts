import { useState, useCallback } from "react"
import {
  RetirementPlan,
  MonteCarloResult,
  MonteCarloResponse,
} from "types/independence"
import {
  scenarioToPayload,
  type ScenarioPayloadCtx,
} from "./scenario/scenarioToPayload"
import { DEFAULT_SCENARIO_STATE, type ScenarioState } from "./scenario/types"
import { AssetBreakdown } from "./useAssetBreakdown"
import { RentalIncomeData } from "./useUnifiedProjection"

interface UseMonteCarloSimulationProps {
  plan: RetirementPlan | undefined
  assets: AssetBreakdown
  monthlyInvestment?: number
  /** Unified scenario state — same shape as useUnifiedProjection. */
  scenario?: ScenarioState
  rentalIncome?: RentalIncomeData
  displayCurrency?: string
}

interface UseMonteCarloSimulationResult {
  result: MonteCarloResult | null
  isRunning: boolean
  error: Error | null
  runSimulation: (iterations?: number) => Promise<void>
}

/**
 * Hook for running Monte Carlo simulations on-demand.
 *
 * Unlike useUnifiedProjection which auto-calculates, this hook exposes a
 * runSimulation() callback that must be triggered explicitly since
 * simulations are computationally expensive. Both hooks share the same
 * ScenarioState → payload translation via `scenarioToPayload`.
 */
export function useMonteCarloSimulation({
  plan,
  assets,
  monthlyInvestment = 0,
  scenario = DEFAULT_SCENARIO_STATE,
  rentalIncome,
  displayCurrency,
}: UseMonteCarloSimulationProps): UseMonteCarloSimulationResult {
  const [result, setResult] = useState<MonteCarloResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const runSimulation = useCallback(
    async (iterations: number = 1000): Promise<void> => {
      if (!plan || !assets.hasAssets) return

      setIsRunning(true)
      setError(null)

      try {
        const ctx: ScenarioPayloadCtx = {
          plan,
          selectedPortfolioIds: [], // Monte Carlo doesn't filter portfolios
          displayCurrency,
          monthlyInvestment,
          rentalIncome,
          derivedLiquidAssets: assets.liquidAssets,
          derivedNonSpendableAssets: assets.nonSpendableAssets,
        }
        const requestBody = {
          ...scenarioToPayload(scenario, ctx),
          iterations,
        }

        const response = await fetch(
          `/api/independence/projection/${plan.id}/monte-carlo`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          },
        )

        if (!response.ok) {
          const errorMsg = "Failed to run Monte Carlo simulation"
          console.error(errorMsg)
          setError(new Error(errorMsg))
          return
        }

        const data: MonteCarloResponse = await response.json()
        setResult(data.data)
      } catch (err) {
        console.error("Monte Carlo simulation failed:", err)
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setIsRunning(false)
      }
    },
    [plan, assets, monthlyInvestment, rentalIncome, scenario, displayCurrency],
  )

  return { result, isRunning, error, runSimulation }
}
