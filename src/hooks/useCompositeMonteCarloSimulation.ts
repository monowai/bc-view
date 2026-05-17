import { useCallback, useState } from "react"
import type {
  CompositePhase,
  MonteCarloResponse,
  MonteCarloResult,
} from "types/independence"

const COMPOSITE_MONTE_CARLO_URL = "/api/independence/composite/monte-carlo"

export interface CompositeMonteCarloRunArgs {
  iterations: number
  phases: CompositePhase[]
  displayCurrency: string
  seed?: number
}

export interface UseCompositeMonteCarloSimulationResult {
  result: MonteCarloResult | null
  isRunning: boolean
  error: Error | null
  runSimulation: (args: CompositeMonteCarloRunArgs) => Promise<void>
}

/**
 * Hook for running composite Monte Carlo simulations on-demand against
 * `POST /composite/monte-carlo`.
 *
 * The return shape mirrors {@link useMonteCarloSimulation} so components
 * (e.g. `MonteCarloResultView`) can consume either interchangeably.
 */
export function useCompositeMonteCarloSimulation(): UseCompositeMonteCarloSimulationResult {
  const [result, setResult] = useState<MonteCarloResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const runSimulation = useCallback(
    async ({
      iterations,
      phases,
      displayCurrency,
      seed,
    }: CompositeMonteCarloRunArgs): Promise<void> => {
      if (phases.length === 0) return

      setIsRunning(true)
      setError(null)

      try {
        const requestBody: Record<string, unknown> = {
          displayCurrency,
          phases,
          iterations,
        }
        if (seed !== undefined) {
          requestBody.seed = seed
        }

        const response = await fetch(COMPOSITE_MONTE_CARLO_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          const message =
            errData.message ||
            `Composite Monte Carlo simulation failed (${response.status})`
          setError(new Error(message))
          return
        }

        const data: MonteCarloResponse = await response.json()
        setResult(data.data)
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setIsRunning(false)
      }
    },
    [],
  )

  return { result, isRunning, error, runSimulation }
}

export default useCompositeMonteCarloSimulation
