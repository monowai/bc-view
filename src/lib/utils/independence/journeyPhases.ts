import type {
  CompositePhase,
  IndependencePlan,
  RetirementPlan,
} from "types/independence"

/**
 * A journey's composite timeline. `phases` arrives as a serialised JSON
 * string, and is absent on a plan that has never been phased; anything
 * unparseable reads as "not phased" rather than throwing at render time.
 */
export function parseJourneyPhases(
  journey: IndependencePlan | undefined,
): CompositePhase[] {
  if (!journey?.phases) return []
  try {
    const parsed = JSON.parse(journey.phases)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (phase): phase is CompositePhase =>
        typeof phase?.planId === "string" && phase.planId.length > 0,
    )
  } catch {
    return []
  }
}

/**
 * Whether this plan carries a composite timeline.
 *
 * This — not a count of the user's `RetirementPlan` rows — is what says "the
 * plan is phased". A user who owns two plans ("with property" against
 * "renting") has many phase plans in total while either plan on its own may
 * still be a single unphased row.
 */
export function isJourneyPhased(
  journey: IndependencePlan | undefined,
): boolean {
  return parseJourneyPhases(journey).length > 0
}

/**
 * The phase plans belonging to one plan (journey), timeline order first.
 *
 * Three links, in descending confidence:
 *  1. the journey's own `phases` — authoritative once phased, and ordered;
 *  2. `RetirementPlan.independencePlanId` — the only link before phasing;
 *  3. legacy rows pre-date that column, so a lone unlinked plan is taken as
 *     this journey's. More than one is ambiguous, and yields nothing rather
 *     than guessing at someone else's journey.
 */
export function journeyPhasePlans(
  journey: IndependencePlan | undefined,
  plans: RetirementPlan[],
): RetirementPlan[] {
  if (!journey) return []

  const byId = new Map(plans.map((plan) => [plan.id, plan]))
  const phased = [...parseJourneyPhases(journey)]
    .sort((a, b) => a.fromAge - b.fromAge)
    .map((phase) => byId.get(phase.planId))
    .filter((plan): plan is RetirementPlan => plan !== undefined)
  if (phased.length > 0) return phased

  const linked = plans.filter((plan) => plan.independencePlanId === journey.id)
  if (linked.length > 0) return linked

  const unlinked = plans.filter((plan) => !plan.independencePlanId)
  return unlinked.length === 1 ? unlinked : []
}

/**
 * The plan whose numbers stand for the user wherever no plan was chosen —
 * the one flagged primary, else the first by name so the pick is at least
 * stable. Mirrors the fallback order in `useActiveIndependencePlan` minus
 * the `?plan=` query parameter, which only /independence carries.
 */
export function primaryJourney(
  journeys: IndependencePlan[],
): IndependencePlan | undefined {
  if (journeys.length === 0) return undefined
  return (
    journeys.find((journey) => journey.isPrimary) ??
    [...journeys].sort((a, b) => a.name.localeCompare(b.name))[0]
  )
}
