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
