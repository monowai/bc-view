import type {
  CompositePhase,
  CompositeProjectionRequest,
  IndependencePlan,
  RetirementPlan,
} from "types/independence"
import { compositeProjectionUrl } from "@utils/api/client/independence"
import { parseJourneyPhases } from "@lib/independence/journeyPhases"

/**
 * The currency a journey is projected in: the one it saved, else its landing
 * plan's, else USD. One definition, so every page that projects a journey
 * asks for the same currency.
 */
export function journeyDisplayCurrency(
  saved: string | undefined,
  landingPlan: Pick<RetirementPlan, "expensesCurrency"> | undefined,
): string {
  return saved || landingPlan?.expensesCurrency || "USD"
}

/** The composite projection request; the work scenario is named only when set. */
export function compositeRequest(
  displayCurrency: string,
  phases: CompositePhase[],
  workScenarioId: string | undefined,
): CompositeProjectionRequest {
  return {
    displayCurrency,
    phases,
    ...(workScenarioId ? { workScenarioId } : {}),
  }
}

/**
 * The projection request for a journey as it is saved, with a key that
 * changes whenever the request would. Null when there is no journey or it has
 * no timeline: nothing to project.
 */
export function savedJourneyProjection(
  journey: IndependencePlan | undefined,
  landingPlan: Pick<RetirementPlan, "expensesCurrency"> | undefined,
): { request: CompositeProjectionRequest; key: readonly unknown[] } | null {
  const phases = parseJourneyPhases(journey)
  if (!journey || phases.length === 0) return null
  const displayCurrency = journeyDisplayCurrency(
    journey.displayCurrency,
    landingPlan,
  )
  return {
    request: compositeRequest(displayCurrency, phases, journey.workScenarioId),
    key: [
      compositeProjectionUrl,
      journey.id,
      journey.phases,
      displayCurrency,
      journey.workScenarioId,
    ],
  }
}
