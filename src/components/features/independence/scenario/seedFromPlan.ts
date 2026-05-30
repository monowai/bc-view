import type {
  RetirementPlan,
  UserIndependenceSettings,
} from "types/independence"
import { DEFAULT_SCENARIO_STATE, type ScenarioState } from "./types"

/**
 * Seed a ScenarioState from the saved plan + user settings. Called on plan
 * load and on reset. `liquidAssets` and `realReturn` are left `null` so the
 * projection uses live holdings / plan per-asset rates until the user moves
 * those sliders explicitly.
 */
export function seedFromPlan(
  plan: RetirementPlan | undefined,
  settings: UserIndependenceSettings | undefined,
  currentYear: number = new Date().getFullYear(),
): ScenarioState {
  if (!plan) {
    return { ...DEFAULT_SCENARIO_STATE }
  }

  const yearOfBirth = settings?.yearOfBirth
  const currentAge =
    yearOfBirth != null ? Math.max(0, currentYear - yearOfBirth) : 0

  return {
    currentAge,
    retirementAge: settings?.targetIndependenceAge ?? 65,
    lifeExpectancy: settings?.lifeExpectancy ?? plan.lifeExpectancy ?? 90,
    liquidAssets: null,
    monthlyExpenses: plan.monthlyExpenses,
    pensionMonthly: plan.pensionMonthly ?? 0,
    // Combine the two pension-shaped income streams at slider level. The
    // payload builder writes the sum to `otherIncomeMonthly` and zeros out
    // social security so the backend sees one figure.
    otherIncomeMonthly:
      (plan.otherIncomeMonthly ?? 0) + (plan.socialSecurityMonthly ?? 0),
    realReturn: null,
    inflation: plan.inflationRate,
  }
}

/**
 * Whether the scenario differs from the seeded baseline. Used to surface a
 * "dirty" badge on the Reset / Save buttons and to decide whether to capture
 * a `baselineProjection` in the projection hook.
 */
export function isScenarioDirty(
  scenario: ScenarioState,
  plan: RetirementPlan | undefined,
  settings: UserIndependenceSettings | undefined,
  currentYear: number = new Date().getFullYear(),
): boolean {
  const seed = seedFromPlan(plan, settings, currentYear)
  return (
    scenario.currentAge !== seed.currentAge ||
    scenario.retirementAge !== seed.retirementAge ||
    scenario.lifeExpectancy !== seed.lifeExpectancy ||
    scenario.liquidAssets !== null ||
    scenario.monthlyExpenses !== seed.monthlyExpenses ||
    scenario.pensionMonthly !== seed.pensionMonthly ||
    scenario.otherIncomeMonthly !== seed.otherIncomeMonthly ||
    scenario.realReturn !== null ||
    scenario.inflation !== seed.inflation
  )
}
