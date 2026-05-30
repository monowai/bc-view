import { useCallback, useMemo, useState } from "react"
import type {
  RetirementPlan,
  UserIndependenceSettings,
} from "types/independence"
import { seedFromPlan } from "./seedFromPlan"
import type { ScenarioState } from "./types"

export interface UseScenarioResult {
  /** Current ScenarioState — drives all projection requests. */
  scenario: ScenarioState
  /** Patch one or more fields. Pass only the fields that change. */
  setScenario: (patch: Partial<ScenarioState>) => void
  /** Restore the seeded values from plan + settings. */
  reset: () => void
  /** Whether the scenario differs from the seeded baseline. */
  isDirty: boolean
}

/**
 * Manages the unified ScenarioState for the projection page.
 *
 * Implementation: the seeded baseline is derived from plan + settings via
 * useMemo, and the user's edits are kept in a `Partial<ScenarioState>` patch.
 * The exposed scenario is the merge of (seed ⨁ patch), which means a plan
 * reload (after save) doesn't clobber in-flight user edits — those live in
 * the patch until the caller invokes `reset()`.
 */
export function useScenario(
  plan: RetirementPlan | undefined,
  settings: UserIndependenceSettings | undefined,
): UseScenarioResult {
  const seed = useMemo(
    () => seedFromPlan(plan, settings),
    [plan, settings],
  )

  const [patch, setPatch] = useState<Partial<ScenarioState>>({})

  const scenario = useMemo<ScenarioState>(
    () => ({ ...seed, ...patch }),
    [seed, patch],
  )

  const setScenario = useCallback((next: Partial<ScenarioState>) => {
    setPatch((prev) => ({ ...prev, ...next }))
  }, [])

  const reset = useCallback(() => {
    setPatch({})
  }, [])

  const isDirty = useMemo(() => Object.keys(patch).length > 0, [patch])

  return { scenario, setScenario, reset, isDirty }
}
