/**
 * Unified scenario state used by the sticky ScenarioBar to model what-if
 * questions across the projection, Stress Test (Monte Carlo) and Wealth-tab
 * views.
 *
 * All values are absolute (playground-style). Two fields use `null` to
 * signal "use the value derived from plan / holdings rather than an
 * explicit override":
 *
 *   - `liquidAssets: null` — keep the live holdings-derived figure.
 *   - `realReturn: null` — keep the plan's per-asset return rates as-is.
 *
 * The old two-shape model (WhatIfAdjustments + ScenarioOverrides) collapsed
 * into this single state. See scenarioToPayload.ts for the translation to
 * the backend projection / Monte Carlo request body.
 */
export interface ScenarioState {
  /** Absolute current age. Seeded from `settings.yearOfBirth`. */
  currentAge: number
  /** Absolute target retirement age. Seeded from `settings.targetIndependenceAge`. */
  retirementAge: number
  /** Absolute life expectancy. Seeded from `settings.lifeExpectancy`. */
  lifeExpectancy: number
  /**
   * Liquid (spendable) assets override in plan currency. `null` means use
   * the value derived from live holdings via `useAssetBreakdown`.
   */
  liquidAssets: number | null
  /** Absolute monthly expenses in plan currency. */
  monthlyExpenses: number
  /** Absolute monthly pension income (plan.pensionMonthly). */
  pensionMonthly: number
  /** Absolute monthly government benefits (plan.socialSecurityMonthly). */
  socialSecurityMonthly: number
  /** Absolute monthly other income (plan.otherIncomeMonthly). */
  otherIncomeMonthly: number
  /**
   * Target blended real return as a decimal (e.g. 0.04 for 4%). `null` keeps
   * the plan's per-asset rates untouched. When set, the payload builder
   * shifts cash + equity rates by the delta needed to hit this target
   * blended nominal return (real + inflation).
   */
  realReturn: number | null
  /** Absolute inflation rate as a decimal (e.g. 0.025 for 2.5%). */
  inflation: number
}

export const DEFAULT_SCENARIO_STATE: ScenarioState = {
  currentAge: 0,
  retirementAge: 65,
  lifeExpectancy: 90,
  liquidAssets: null,
  monthlyExpenses: 0,
  pensionMonthly: 0,
  socialSecurityMonthly: 0,
  otherIncomeMonthly: 0,
  realReturn: null,
  inflation: 0.025,
}
