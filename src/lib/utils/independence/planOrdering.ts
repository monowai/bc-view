import type {
  CompositePhase,
  RetirementPlan,
  UserIndependenceSettings,
} from "types/independence"

/**
 * Safely parse the JSON-encoded `compositePhases` field stored on
 * {@link UserIndependenceSettings}. Returns `null` for missing, empty or
 * malformed payloads so callers can fall back to the backend default
 * order without branching on every step.
 */
function parseCompositePhases(
  json: string | undefined,
): CompositePhase[] | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {
    // fall through
  }
  return null
}

/**
 * Sort a list of retirement plans so that plans referenced by the user's
 * composite configuration appear in the same order the user defined on
 * the Composite tab, followed by plans not in the composite in their
 * original (backend) order.
 *
 * The backend sorts plans primary-first-then-by-name; that's a reasonable
 * default when no composite has been configured. Once the user has built
 * a composite, the phase sequence is a stronger signal of intent — a
 * Singapore → Thailand → NZ timeline should show those three cards in
 * that order everywhere they're listed, regardless of their names or
 * primary flag.
 *
 * - Plans whose id appears in `compositePhases` are placed first in the
 *   order of appearance in the phases array
 * - Plans whose id does not appear are placed after, preserving the
 *   backend's original relative order (stable sort)
 * - If there are no composite phases configured, the input list is
 *   returned unchanged
 *
 * @param plans    The plans returned from the backend (already primary-first)
 * @param settings The user's independence settings, or undefined if still loading
 * @returns A new array with the composite order applied
 */
export function sortPlansByCompositeOrder(
  plans: RetirementPlan[],
  settings: UserIndependenceSettings | undefined,
): RetirementPlan[] {
  const phases = parseCompositePhases(settings?.compositePhases)
  if (!phases) return plans

  // Build a map from planId to its index in the composite phase sequence.
  // `Number.MAX_SAFE_INTEGER` is the sentinel for "not in the composite",
  // so those plans sort after anything with a real index.
  const orderIndex = new Map<string, number>()
  phases.forEach((phase, i) => {
    if (!orderIndex.has(phase.planId)) {
      orderIndex.set(phase.planId, i)
    }
  })

  // Map each plan to [originalIndex, plan] so the sort stays stable for
  // plans outside the composite (Array.prototype.sort is stable since
  // ES2019, but keeping the tiebreaker explicit is safer).
  const decorated = plans.map((plan, originalIndex) => ({
    plan,
    compositeIndex: orderIndex.get(plan.id) ?? Number.MAX_SAFE_INTEGER,
    originalIndex,
  }))

  decorated.sort((a, b) => {
    if (a.compositeIndex !== b.compositeIndex) {
      return a.compositeIndex - b.compositeIndex
    }
    return a.originalIndex - b.originalIndex
  })

  return decorated.map((d) => d.plan)
}
