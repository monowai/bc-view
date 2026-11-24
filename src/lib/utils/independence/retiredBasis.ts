import type {
  CompositePhase,
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
  /** Currency of {@link liquidAssets} and {@link plannedAnnualDraw}. */
  currency: string
  liquidAssets: number
  /** This year's planned draw on the liquid pot; undefined when not known. */
  plannedAnnualDraw: number | undefined
  lifeExpectancy: number | undefined
  /** The phase plan whose expenses are the current budget. */
  budgetPlanId: string | undefined
  /**
   * Currency the budget plan's expenses are priced in. A journey reports in
   * its display currency while each phase budgets in its own.
   */
  budgetCurrency: string
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
    budgetCurrency: currency,
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
 * The phase the owner is in: the latest to have started by their age. The
 * earliest phase when the age is unknown or comes before all of them.
 */
function currentPhase(
  phases: CompositePhase[],
  currentAge: number | undefined,
): CompositePhase | undefined {
  const ordered = [...phases].sort((a, b) => a.fromAge - b.fromAge)
  const started =
    currentAge == null
      ? []
      : ordered.filter((phase) => phase.fromAge <= currentAge)
  return started[started.length - 1] ?? ordered[0]
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
  const budgetPlanId =
    currentRow?.planId ?? currentPhase(phases, currentAge)?.planId
  // The phase's own currency as svc-retire echoes it; a projection that does
  // not name the phase leaves the display currency as the only one known.
  const budgetCurrency =
    projection.phases.find((phase) => phase.planId === budgetPlanId)
      ?.expensesCurrency ?? displayCurrency
  return {
    currency: displayCurrency,
    liquidAssets,
    plannedAnnualDraw: projection.plannedAnnualDraw,
    lifeExpectancy,
    budgetPlanId,
    budgetCurrency,
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
