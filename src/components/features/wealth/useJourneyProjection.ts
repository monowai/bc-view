import useSwr from "swr"
import type {
  CompositeProjectionResult,
  IndependencePlan,
  RetirementPlan,
} from "types/independence"
import { runCompositeProjection } from "@utils/api/client/independence"
import { savedJourneyProjection } from "@lib/independence/journeyRequest"

/**
 * The journey's projection as saved, read-only: no editing state and nothing
 * written back. A journey with no timeline has nothing to project and is not
 * fetched. `landingPlan` supplies the currency for a journey that saved none.
 */
export function useJourneyProjection(
  journey: IndependencePlan | undefined,
  landingPlan?: Pick<RetirementPlan, "expensesCurrency">,
): {
  projection: CompositeProjectionResult | null
  isLoading: boolean
  error: Error | undefined
} {
  const saved = savedJourneyProjection(journey, landingPlan)
  const { data, isLoading, error } = useSwr<CompositeProjectionResult, Error>(
    saved?.key ?? null,
    async () => {
      if (!saved) throw new Error("No journey to project")
      const res = await runCompositeProjection(saved.request)
      if (!res.ok) throw new Error(`Journey projection failed (${res.status})`)
      const body: { data: CompositeProjectionResult } = await res.json()
      return body.data
    },
    { revalidateOnFocus: false },
  )
  return { projection: data ?? null, isLoading, error }
}
