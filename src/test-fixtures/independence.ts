/**
 * Shared test fixtures for Independence (svc-retire) types.
 *
 * Each builder takes `Partial<T>` overrides over a fully-formed default.
 */
import type { RetirementPlan } from "types/independence"
import type { CompositeProjectionValue } from "@components/features/independence/composite/CompositeProjectionContext"

/** A complete RetirementPlan (phase) as svc-retire returns it. */
export function makePlan(
  overrides: Partial<RetirementPlan> = {},
): RetirementPlan {
  return {
    id: "plan-1",
    ownerId: "owner-1",
    name: "Test Plan",
    planningHorizonYears: 30,
    lifeExpectancy: 90,
    monthlyExpenses: 3000,
    expensesCurrency: "SGD",
    cashReturnRate: 0.02,
    equityReturnRate: 0.07,
    housingReturnRate: 0.03,
    inflationRate: 0.03,
    cashAllocation: 20,
    equityAllocation: 60,
    housingAllocation: 20,
    pensionMonthly: 0,
    socialSecurityMonthly: 0,
    otherIncomeMonthly: 0,
    workingIncomeMonthly: 0,
    workingExpensesMonthly: 0,
    taxesMonthly: 0,
    bonusMonthly: 0,
    investmentAllocationPercent: 80,
    isPrimary: false,
    createdDate: "2025-01-01",
    updatedDate: "2025-01-01",
    ...overrides,
  }
}

/**
 * A settled, empty composite-projection context: no plans, no phases, no
 * projection, every setter a `jest.fn()`.
 */
export function makeCompositeCtx(
  overrides: Partial<CompositeProjectionValue> = {},
): CompositeProjectionValue {
  return {
    plans: [],
    phases: [],
    setPhases: jest.fn(),
    displayCurrency: "USD",
    setDisplayCurrency: jest.fn(),
    excludedPlanIds: new Set<string>(),
    toggleExclusion: jest.fn(),
    compositeWorkScenarioId: undefined,
    setCompositeWorkScenarioId: jest.fn(),
    refreshProjection: jest.fn(),
    projection: undefined,
    scenarios: undefined,
    isLoading: false,
    isSettled: true,
    error: null,
    mc: { result: null, isRunning: false, error: null, run: jest.fn() },
    ...overrides,
  }
}
