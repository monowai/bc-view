import type { RetirementPlan } from "types/independence"
import type { RentalIncomeData } from "../useUnifiedProjection"
import type { ScenarioState } from "./types"

/**
 * Caller-supplied context the ScenarioState alone can't carry: portfolio
 * filtering, derived asset totals, rental income, etc.
 */
export interface ScenarioPayloadCtx {
  plan: RetirementPlan
  selectedPortfolioIds: string[]
  displayCurrency?: string
  /** Monthly investment contribution amount (pre-retirement). */
  monthlyInvestment: number
  /** Defined contribution override (svc-retire calculates from contributions otherwise). */
  definedContribution?: number
  rentalIncome?: RentalIncomeData
  /** Liquid assets derived from live holdings (fallback when `scenario.liquidAssets` is null). */
  derivedLiquidAssets: number
  /** Non-spendable assets derived from live holdings. */
  derivedNonSpendableAssets: number
  /**
   * Set when the viewer doesn't own the plan. Omits `liquidAssets` /
   * `nonSpendableAssets` from the projection request so svc-retire's
   * shared-plan M2M path resolves the OWNER's holdings via svc-position
   * instead of accepting the viewer's caller-scoped totals.
   */
  isSharedPlan?: boolean
  /** Request the optional ProjectionDebug block in the response. */
  includeDebug?: boolean
}

/**
 * Translates a ScenarioState + context into the JSON body posted to the
 * deterministic projection endpoint (`/api/independence/projection/{id}`)
 * and the Monte Carlo endpoint (`/api/independence/projection/{id}/monte-carlo`).
 * Backend accepts the same shape for both — see ProjectionRequest +
 * MonteCarloRequest in svc-retire.
 */
export function scenarioToPayload(
  scenario: ScenarioState,
  ctx: ScenarioPayloadCtx,
): Record<string, unknown> {
  const { equityReturnRate, cashReturnRate, housingReturnRate } =
    applyRealReturn(scenario, ctx.plan)

  const payload: Record<string, unknown> = {
    portfolioIds: ctx.selectedPortfolioIds,
    currency: ctx.plan.expensesCurrency,
    displayCurrency: ctx.displayCurrency,
    currentAge: scenario.currentAge,
    retirementAge: scenario.retirementAge,
    lifeExpectancy: scenario.lifeExpectancy,
    monthlyContribution: ctx.monthlyInvestment,
    monthlyExpenses: scenario.monthlyExpenses,
    cashReturnRate,
    equityReturnRate,
    housingReturnRate,
    inflationRate: scenario.inflation,
    pensionMonthly: scenario.pensionMonthly,
    socialSecurityMonthly: scenario.socialSecurityMonthly,
    otherIncomeMonthly: scenario.otherIncomeMonthly,
    targetBalance: ctx.plan.targetBalance,
  }

  // For owned plans the viewer's holdings are correct projection inputs;
  // for shared plans they belong to the viewer, NOT the plan owner — let
  // svc-retire resolve them server-side via the M2M + ?systemUserId path.
  if (!ctx.isSharedPlan) {
    payload.liquidAssets = scenario.liquidAssets ?? ctx.derivedLiquidAssets
    payload.nonSpendableAssets = ctx.derivedNonSpendableAssets
  } else if (scenario.liquidAssets != null) {
    // Slider explicitly overrode liquid for what-if even on a shared plan.
    payload.liquidAssets = scenario.liquidAssets
  }

  if (ctx.definedContribution != null) {
    payload.definedContribution = ctx.definedContribution
  }
  if (ctx.rentalIncome?.totalMonthlyInPlanCurrency) {
    payload.rentalIncomeMonthly = ctx.rentalIncome.totalMonthlyInPlanCurrency
  }
  if (ctx.includeDebug) {
    payload.includeDebug = true
  }

  return payload
}

/**
 * Resolves the scenario's `realReturn` slider against the plan's per-asset
 * rates. When the slider is null, plan rates pass through unchanged. When
 * set, we shift cash + equity by the delta needed to land on the requested
 * blended nominal return (realReturn + inflation). Housing is left alone —
 * it represents non-investable (property) growth that the playground's
 * "real return" slider intentionally doesn't touch.
 */
export function applyRealReturn(
  scenario: ScenarioState,
  plan: RetirementPlan,
): {
  cashReturnRate: number
  equityReturnRate: number
  housingReturnRate: number
} {
  if (scenario.realReturn === null) {
    return {
      cashReturnRate: plan.cashReturnRate,
      equityReturnRate: plan.equityReturnRate,
      housingReturnRate: plan.housingReturnRate,
    }
  }

  // Anchor the delta against the plan's saved inflation, NOT the scenario's
  // inflation slider — otherwise moving the Inflation slider before the Real
  // Return slider would silently shift the real-return baseline and the
  // resulting cash + equity rates wouldn't correspond to the requested real
  // return any more.
  const planBlended = blendedReturnRate(plan)
  const targetNominalBlended = scenario.realReturn + plan.inflationRate
  const delta = targetNominalBlended - planBlended

  return {
    cashReturnRate: plan.cashReturnRate + delta,
    equityReturnRate: plan.equityReturnRate + delta,
    housingReturnRate: plan.housingReturnRate,
  }
}

/**
 * Weighted blended return of cash + equity allocations. Mirrors the
 * backend's `CalculationService.calculateBlendedReturnRate` so the slider's
 * delta math stays consistent.
 */
export function blendedReturnRate(plan: RetirementPlan): number {
  const investable = plan.cashAllocation + plan.equityAllocation
  if (investable <= 0) return 0
  const cashWeight = plan.cashAllocation / investable
  const equityWeight = plan.equityAllocation / investable
  return cashWeight * plan.cashReturnRate + equityWeight * plan.equityReturnRate
}
