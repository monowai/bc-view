import useSwr from "swr"
import type {
  CompositeProjectionRequest,
  CompositeProjectionResult,
  IndependencePlan,
} from "types/independence"
import {
  compositeProjectionUrl,
  runCompositeProjection,
} from "@utils/api/client/independence"
import { parseJourneyPhases } from "@lib/independence/journeyPhases"

/**
 * The journey's projection as saved, read-only: no editing state and nothing
 * written back. A journey with no timeline, or no display currency to project
 * in, has nothing to project and is not fetched.
 */
export function useJourneyProjection(journey: IndependencePlan | undefined): {
  projection: CompositeProjectionResult | null
  isLoading: boolean
  error: Error | undefined
} {
  const phases = parseJourneyPhases(journey)
  const displayCurrency = journey?.displayCurrency
  const workScenarioId = journey?.workScenarioId
  const key =
    journey && phases.length > 0 && displayCurrency
      ? [
          compositeProjectionUrl,
          journey.id,
          journey.phases,
          displayCurrency,
          workScenarioId,
        ]
      : null
  const { data, isLoading, error } = useSwr<CompositeProjectionResult, Error>(
    key,
    async () => {
      const request: CompositeProjectionRequest = {
        displayCurrency: displayCurrency ?? "",
        phases,
        ...(workScenarioId ? { workScenarioId } : {}),
      }
      const res = await runCompositeProjection(request)
      if (!res.ok) throw new Error(`Journey projection failed (${res.status})`)
      const body: { data: CompositeProjectionResult } = await res.json()
      return body.data
    },
    { revalidateOnFocus: false },
  )
  return { projection: data ?? null, isLoading, error }
}
