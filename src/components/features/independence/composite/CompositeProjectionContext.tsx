import React, { createContext, useContext, ReactNode } from "react"
import type {
  CompositePhase,
  CompositeProjectionResult,
  CompositeScenarioComparison,
  RetirementPlan,
} from "types/independence"

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
  setPhases: (phases: CompositePhase[]) => void
  displayCurrency: string
  setDisplayCurrency: (currency: string) => void
  excludedPlanIds: Set<string>
  toggleExclusion: (planId: string) => void
  /** Work scenario ID selected for composite projections. */
  compositeWorkScenarioId: string | undefined
  setCompositeWorkScenarioId: (id: string | undefined) => void
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
  error: string | null
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
