import type {
  CompositeProjectionResult,
  IndependencePlan,
  RetirementProjection,
} from "types/independence"
import {
  compositeMonteCarloUrl,
  monteCarloUrl,
  runCompositeMonteCarlo,
  runMonteCarlo,
} from "@utils/api/client/independence"
import { parseJourneyPhases } from "@lib/independence/journeyPhases"
import { plannedAnnualDrawdown } from "@lib/independence/retiredMetrics"

/**
 * What the retired tiles report on: the journey, or one phase projected alone
 * for an account that has no journey.
 */
export interface RetiredBasis {
  currency: string
  liquidAssets: number
  /** This year's planned draw on the liquid pot. */
  plannedAnnualDraw: number
  lifeExpectancy: number | undefined
  /** The phase plan whose expenses are the current budget. */
  budgetPlanId: string | undefined
  /** Identifies the simulation: a new key is a new run. */
  monteCarloKey: readonly unknown[]
  runMonteCarlo: (seed: number) => Promise<Response>
}

/** One phase, projected alone for the whole horizon. */
export function phaseRetiredBasis(
  projection: RetirementProjection,
): RetiredBasis {
  const { planId, currency, liquidAssets } = projection
  const nonSpendableAssets = projection.totalAssets - liquidAssets
  return {
    currency,
    liquidAssets,
    plannedAnnualDraw: plannedAnnualDrawdown(projection),
    lifeExpectancy: projection.planInputs?.lifeExpectancy,
    budgetPlanId: planId,
    monteCarloKey: [
      monteCarloUrl(planId),
      currency,
      liquidAssets,
      nonSpendableAssets,
    ],
    runMonteCarlo: (seed) =>
      runMonteCarlo(planId, {
        currency,
        liquidAssets,
        nonSpendableAssets,
        seed,
      }),
  }
}

/**
 * The journey as svc-retire projected it. Every figure is the backend's; the
 * budget is that of the phase the owner is in now.
 */
export function journeyRetiredBasis(
  journey: IndependencePlan,
  projection: CompositeProjectionResult,
  lifeExpectancy: number | undefined,
): RetiredBasis {
  const phases = parseJourneyPhases(journey)
  const { displayCurrency, liquidAssets, currentAge } = projection
  const currentRow = projection.yearlyProjections.find(
    (row) => row.age === currentAge,
  )
  const firstPhase = [...phases].sort((a, b) => a.fromAge - b.fromAge)[0]
  return {
    currency: displayCurrency,
    liquidAssets,
    plannedAnnualDraw: projection.plannedAnnualDraw ?? 0,
    lifeExpectancy,
    budgetPlanId: currentRow?.planId ?? firstPhase?.planId,
    monteCarloKey: [
      compositeMonteCarloUrl,
      journey.id,
      journey.phases,
      displayCurrency,
      journey.workScenarioId,
      liquidAssets,
    ],
    runMonteCarlo: (seed) =>
      runCompositeMonteCarlo({
        displayCurrency,
        phases,
        ...(journey.workScenarioId
          ? { workScenarioId: journey.workScenarioId }
          : {}),
        seed,
      }),
  }
}
