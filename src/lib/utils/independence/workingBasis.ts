import type {
  CompositeProjectionResult,
  RetirementPlan,
  RetirementProjection,
} from "types/independence"
import { compositeAnswers } from "@lib/independence/compositeAnswers"
import {
  type HeadlineGauge,
  pickHeadlineGauge,
} from "@utils/independence/headlineGauge"

/** What the projection says about the road to independence. */
export interface WorkingOutlook {
  headline: HeadlineGauge
  /** Liquid assets have reached the independence number. */
  independent: boolean
  /** Whole years until independence; null when the projection never gets there. */
  yearsToFi: number | null
  fiAge: number | null
  /** Age at which property is sold to fund spending; undefined when it never is. */
  liquidationAge: number | undefined
  /** Whether any non-spendable value is carried into retirement; undefined when not stated. */
  hasProperty: boolean | undefined
}

/**
 * What the working-years tiles report on: the journey, or one phase projected
 * alone for an account that has no journey.
 */
export interface WorkingBasis {
  /** Currency of {@link monthlyContribution}; undefined until a projection lands. */
  currency: string | undefined
  /** The monthly investment target; undefined when it is not known. */
  monthlyContribution: number | undefined
  /** Null until a projection has landed. */
  outlook: WorkingOutlook | null
}

/**
 * The plan's net contribution, by the formula svc-retire uses: the surplus
 * includes bonus and is net of taxes. Stands in only until the phase
 * projection echoes the figure.
 */
function planContribution(plan: RetirementPlan): number {
  const surplus =
    (plan.workingIncomeMonthly ?? 0) +
    (plan.bonusMonthly ?? 0) -
    (plan.workingExpensesMonthly ?? 0) -
    (plan.taxesMonthly ?? 0)
  return Math.max(surplus * (plan.investmentAllocationPercent ?? 0.8), 0)
}

/** One phase, projected alone for the whole horizon. */
export function phaseWorkingBasis(
  projection: RetirementProjection | null,
  plan: RetirementPlan,
): WorkingBasis {
  const monthlyContribution =
    projection?.preRetirementAccumulation?.monthlyContribution ??
    planContribution(plan)
  if (!projection) {
    return { currency: undefined, monthlyContribution, outlook: null }
  }
  const fi = projection.fiMetrics
  return {
    currency: projection.currency,
    monthlyContribution,
    outlook: {
      headline: pickHeadlineGauge(projection.effectiveHeadlineMetric, fi),
      independent: fi?.isFinanciallyIndependent ?? false,
      yearsToFi:
        fi?.realYearsToFi != null ? Math.round(fi.realYearsToFi) : null,
      fiAge: projection.fiAchievementAge ?? null,
      liquidationAge: projection.yearlyProjections?.find(
        (year) => year.propertyLiquidated,
      )?.age,
      hasProperty: (projection.nonSpendableAtRetirement ?? 0) > 0,
    },
  }
}

/**
 * The journey as svc-retire projected it. Every figure is the backend's, or
 * read off its rows by the same {@link compositeAnswers} the journey page
 * leads with, so the two pages agree.
 */
export function journeyWorkingBasis(
  projection: CompositeProjectionResult,
): WorkingBasis {
  const answers = compositeAnswers(projection, projection.currentAge)
  const carried = projection.nonSpendableAtRetirement
  return {
    currency: projection.displayCurrency,
    monthlyContribution: projection.monthlyContribution,
    outlook: {
      headline: pickHeadlineGauge(projection.effectiveHeadlineMetric, {
        fiProgress: projection.fiProgress,
        retirementAgeFiProgress: projection.retirementAgeFiProgress,
      }),
      independent: answers?.isAchieved ?? false,
      yearsToFi: answers?.yearsToFi ?? null,
      fiAge: answers?.fiCrossingAge ?? null,
      liquidationAge: projection.liquidationAge,
      hasProperty: carried == null ? undefined : carried > 0,
    },
  }
}
