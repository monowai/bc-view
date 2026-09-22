import React, {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import type {
  CompositePhase,
  CompositeProjectionResult,
  CompositeScenarioComparison,
  MonteCarloResult,
  RetirementPlan,
} from "types/independence"
import type { CompositeMonteCarloRunArgs } from "@hooks/useCompositeMonteCarloSimulation"

/**
 * The single stress run for this plan.
 *
 * Lives on the context because its result is read in two places — the
 * confidence figure in the verdict and the bands on the chart. It used to be
 * two independent `useCompositeMonteCarloSimulation()` calls behind two tabs,
 * each with its own iteration picker, so the same plan could show 87% in one
 * place and 74% in another depending on which tab you had last visited.
 */
export interface CompositeMonteCarloState {
  result: MonteCarloResult | null
  isRunning: boolean
  error: Error | null
  run: (args: CompositeMonteCarloRunArgs) => Promise<void>
}

/**
 * Context value exposed by {@link CompositeProjectionProvider}.
 *
 * Field shape mirrors {@link useCompositeProjection}'s return value plus
 * the source `plans` array (needed by sub-tabs to map planId → plan info
 * and derive currency lists).
 */
export interface CompositeProjectionValue {
  // Source plans (needed by sub-tabs for plan lookups / currency lists)
  plans: RetirementPlan[]

  // Inputs / setters (from useCompositeProjection)
  phases: CompositePhase[]
  setPhases: Dispatch<SetStateAction<CompositePhase[]>>
  displayCurrency: string
  setDisplayCurrency: (currency: string) => void
  excludedPlanIds: Set<string>
  toggleExclusion: (planId: string) => void
  /** Work scenario ID selected for composite projections. */
  compositeWorkScenarioId: string | undefined
  setCompositeWorkScenarioId: (id: string | undefined) => void
  /**
   * Re-run the projection for the same request. For levers that change a
   * stage plan in place (its rates, its inheritance) — the request the
   * projection keys off is unchanged, so nothing else would re-fetch it.
   */
  refreshProjection: () => void
  /**
   * Current age to display — prefers the backend-echoed
   * `CompositeProjectionResult.currentAge` once a projection has landed,
   * falling back to a local derivation for first paint (bc-view #1144).
   */
  currentAge?: number

  // Results
  projection: CompositeProjectionResult | undefined
  scenarios: CompositeScenarioComparison | undefined
  isLoading: boolean
  /** See useCompositeProjection — 'no answer yet' vs 'asked and got nothing'. */
  isSettled: boolean
  error: string | null

  /** The one stress run shared by the verdict and the chart. */
  mc: CompositeMonteCarloState
}

const CompositeProjectionCtx = createContext<CompositeProjectionValue | null>(
  null,
)

export function CompositeProjectionProvider({
  value,
  children,
}: {
  value: CompositeProjectionValue
  children: ReactNode
}): React.ReactElement {
  return (
    <CompositeProjectionCtx.Provider value={value}>
      {children}
    </CompositeProjectionCtx.Provider>
  )
}

export function useCompositeProjectionContext(): CompositeProjectionValue {
  const v = useContext(CompositeProjectionCtx)
  if (!v) {
    throw new Error(
      "useCompositeProjectionContext must be used within CompositeProjectionProvider",
    )
  }
  return v
}
