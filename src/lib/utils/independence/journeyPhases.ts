import type {
  CompositePhase,
  IndependencePlan,
  RetirementPlan,
} from "types/independence"
import type { Portfolio } from "types/beancounter"
import { parseExcludedPortfolioIds } from "./planHelpers"

/**
 * A journey's composite timeline. `phases` arrives as a serialised JSON
 * string, and is absent on a plan that has never been phased; anything
 * unparseable reads as "not phased" rather than throwing at render time.
 *
 * `fromAge` is validated, not just `planId`: the timeline is *ordered* by it
 * (see {@link journeyPhasePlans}), and a phase carrying a missing or
 * non-numeric age would sort on `NaN` and scramble the order of every phase
 * around it. A phase without a usable age is not a phase.
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
        typeof phase?.planId === "string" &&
        phase.planId.length > 0 &&
        typeof phase.fromAge === "number" &&
        Number.isFinite(phase.fromAge),
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
 * stable.
 *
 * This is the single definition of that order. `useActiveIndependencePlan`
 * delegates here for its fallback rather than restating it, so the journey
 * /wealth reads and the one /independence lands on can never drift apart;
 * `?plan=` is the only thing that hook adds on top, and only /independence
 * carries it.
 */
/**
 * The plan a journey opens at — the one flagged primary, else the first of the
 * list so the pick is at least stable.
 *
 * Resolves *within the list it is handed*, and that list is the caller's
 * responsibility: `RetirementPlan.isPrimary` is scoped to the journey a plan
 * belongs to, not the account (svc-retire#248), so a user running "life owning
 * the house" alongside "life renting" has one primary per journey. Searching
 * every owned row lands on whichever journey happens to sort first — pass
 * {@link journeyPhasePlans} output, not the raw `/plans` response.
 */
export function landingPlan(
  plans: RetirementPlan[],
): RetirementPlan | undefined {
  return plans.find((plan) => plan.isPrimary) ?? plans[0]
}

export function primaryJourney(
  journeys: IndependencePlan[],
): IndependencePlan | undefined {
  if (journeys.length === 0) return undefined
  return (
    journeys.find((journey) => journey.isPrimary) ??
    [...journeys].sort((a, b) => a.name.localeCompare(b.name))[0]
  )
}

/**
 * The portfolios a journey draws on — every one the user owns, less the ones
 * that journey excludes.
 *
 * Feeds the wizard's allocation seeding, which reads the real holdings behind
 * these ids. Two states deliberately answer "nothing yet" rather than "all of
 * them", because the caller latches after its first non-empty answer and a
 * premature one is never corrected:
 *
 *  - the journeys request is still in flight. It resolves independently of the
 *    portfolios request, so "no journey found" is not yet the same as "this
 *    journey excludes nothing".
 *  - the named journey does not resolve at all — a stale or deleted id. Seeding
 *    from everything would describe wealth the journey never claimed.
 *
 * Naming no journey is different again: there is nothing to narrow by, so every
 * portfolio counts. That is the legacy ungrouped stage.
 */
export function portfoliosForJourney({
  portfolios,
  journeys,
  journeyId,
  journeysLoading,
}: {
  portfolios: Portfolio[]
  journeys: IndependencePlan[]
  journeyId: string | undefined
  journeysLoading: boolean
}): string[] {
  if (portfolios.length === 0) return []
  if (!journeyId) return portfolios.map((portfolio) => portfolio.id)
  if (journeysLoading) return []

  const journey = journeys.find((candidate) => candidate.id === journeyId)
  if (!journey) return []

  const excluded = new Set(
    parseExcludedPortfolioIds(journey.excludedPortfolioIds),
  )
  return portfolios
    .filter((portfolio) => !excluded.has(portfolio.id))
    .map((portfolio) => portfolio.id)
}
