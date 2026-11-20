import { useMemo } from "react"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import type { PlansResponse, RetirementPlan } from "types/independence"
import { plansKey } from "@utils/api/client/independence"
import { useIndependencePlans } from "@hooks/useIndependencePlans"
import {
  journeyPhasePlans,
  landingPlan,
  primaryJourney,
} from "@lib/independence/journeyPhases"

/**
 * The phase plan whose numbers drive the independence headline.
 *
 * `/plans` returns phase plans across *every* plan the user owns, so an index
 * into that list picks whichever journey happens to sort first — "life
 * renting" reported under a dashboard the user reads as "life owning the
 * house". Resolve through the primary journey and take a phase of its own.
 * With no journey at all (legacy account, or the list still loading) degrade
 * to the plan the user flagged primary, and to nothing rather than an
 * arbitrary row. `resolved` turns true once both lists have answered, so
 * "no primary plan" can be told apart from "not loaded yet". A failed plans
 * request counts as answered with no plan, so callers are not left waiting.
 */
export function usePrimaryPlan(): {
  primaryPlan: RetirementPlan | undefined
  resolved: boolean
} {
  const { data: plansData, error: plansError } = useSwr<PlansResponse>(
    plansKey,
    simpleFetcher(plansKey),
  )
  const { plans: journeys, isLoading: journeysLoading } = useIndependencePlans()
  const phasePlans = useMemo(() => plansData?.data ?? [], [plansData?.data])
  const primaryPlan = useMemo(() => {
    const ownPhases = journeyPhasePlans(primaryJourney(journeys), phasePlans)
    return landingPlan(ownPhases) ?? phasePlans.find((plan) => plan.isPrimary)
  }, [journeys, phasePlans])
  return {
    primaryPlan,
    resolved:
      !journeysLoading && (plansData !== undefined || plansError !== undefined),
  }
}
