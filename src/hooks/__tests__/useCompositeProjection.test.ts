import { renderHook, act } from "@testing-library/react"
import {
  buildInitialPhases,
  useCompositeProjection,
} from "../useCompositeProjection"
import type { RetirementPlan } from "types/independence"

jest.mock("@hooks/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({ updateSettings: jest.fn() }),
}))

function makePlan(overrides: Partial<RetirementPlan> = {}): RetirementPlan {
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

describe("buildInitialPhases", () => {
  it("creates a single phase for one plan", () => {
    const plans = [makePlan({ id: "p1" })]
    const phases = buildInitialPhases(plans, new Set(), 60, 90)

    expect(phases).toHaveLength(1)
    expect(phases[0].planId).toBe("p1")
    expect(phases[0].fromAge).toBe(60)
    expect(phases[0].toAge).toBeUndefined()
  })

  it("distributes ages evenly across two plans", () => {
    const plans = [
      makePlan({ id: "p1", name: "Plan A" }),
      makePlan({ id: "p2", name: "Plan B" }),
    ]
    const phases = buildInitialPhases(plans, new Set(), 60, 90)

    expect(phases).toHaveLength(2)
    expect(phases[0].planId).toBe("p1")
    expect(phases[0].fromAge).toBe(60)
    expect(phases[0].toAge).toBe(75)
    expect(phases[1].planId).toBe("p2")
    expect(phases[1].fromAge).toBe(75)
    expect(phases[1].toAge).toBeUndefined()
  })

  it("distributes ages evenly across three plans", () => {
    const plans = [
      makePlan({ id: "p1" }),
      makePlan({ id: "p2" }),
      makePlan({ id: "p3" }),
    ]
    const phases = buildInitialPhases(plans, new Set(), 60, 90)

    expect(phases).toHaveLength(3)
    expect(phases[0].fromAge).toBe(60)
    expect(phases[0].toAge).toBe(70)
    expect(phases[1].fromAge).toBe(70)
    expect(phases[1].toAge).toBe(80)
    expect(phases[2].fromAge).toBe(80)
    expect(phases[2].toAge).toBeUndefined()
  })

  it("excludes plans in excludedPlanIds", () => {
    const plans = [
      makePlan({ id: "p1" }),
      makePlan({ id: "p2" }),
      makePlan({ id: "p3" }),
    ]
    const phases = buildInitialPhases(plans, new Set(["p2"]), 60, 90)

    expect(phases).toHaveLength(2)
    expect(phases.find((p) => p.planId === "p2")).toBeUndefined()
    expect(phases[0].planId).toBe("p1")
    expect(phases[1].planId).toBe("p3")
  })

  it("returns empty array when all plans are excluded", () => {
    const plans = [makePlan({ id: "p1" })]
    const phases = buildInitialPhases(plans, new Set(["p1"]), 60, 90)

    expect(phases).toHaveLength(0)
  })

  it("returns empty array when no plans provided", () => {
    const phases = buildInitialPhases([], new Set(), 60, 90)
    expect(phases).toHaveLength(0)
  })

  it("handles uneven distribution with remainder", () => {
    const plans = [
      makePlan({ id: "p1" }),
      makePlan({ id: "p2" }),
      makePlan({ id: "p3" }),
    ]
    // 31 years / 3 plans = 10 each + 1 remainder
    const phases = buildInitialPhases(plans, new Set(), 59, 90)

    expect(phases).toHaveLength(3)
    // First plan gets the extra year from remainder
    expect(phases[0].fromAge).toBe(59)
    expect(phases[0].toAge).toBe(70)
    expect(phases[1].fromAge).toBe(70)
    expect(phases[1].toAge).toBe(80)
    expect(phases[2].fromAge).toBe(80)
    expect(phases[2].toAge).toBeUndefined()
  })

  it("last phase always has undefined toAge", () => {
    const plans = [makePlan({ id: "p1" }), makePlan({ id: "p2" })]
    const phases = buildInitialPhases(plans, new Set(), 60, 90)

    expect(phases[phases.length - 1].toAge).toBeUndefined()
  })
})

// bc-view #1144: the composite hook must prefer the backend-echoed
// currentAge (CompositeProjectionResult.currentAge, month-of-birth aware,
// resolved server-side from the plan owner's settings) over any
// client-derived value once a projection has landed. The client-side
// derivation remains ONLY as a fallback for first paint, before any
// projection response exists — and even then it must be month-of-birth
// aware (via currentAgeFromSettings), not a naive currentYear - yearOfBirth.
describe("useCompositeProjection — currentAge", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    // Pin "now" to a known date (June 15) so month-of-birth comparisons
    // are deterministic regardless of when the test suite actually runs.
    jest.setSystemTime(new Date(2026, 5, 15))
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("derives currentAge locally (month-of-birth aware) before any projection has landed", () => {
    // Birth month (December, 1-based 12) is AFTER "now" (June) → local
    // derivation must subtract one year. A naive `currentYear -
    // yearOfBirth` would get this wrong (it would report 40, not 39).
    const yearOfBirth = 1986
    const monthOfBirth = 12

    const plans = [makePlan({ id: "p1", isPrimary: true, yearOfBirth })]

    const { result } = renderHook(() =>
      useCompositeProjection(plans, {
        yearOfBirth,
        monthOfBirth,
      } as unknown as import("types/independence").UserIndependenceSettings),
    )

    // 2026 - 1986 = 40, minus 1 since birth month hasn't happened yet.
    expect(result.current.currentAge).toBe(39)
  })

  it("prefers the projection's echoed currentAge once a projection has landed", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { currentAge: 47, yearlyProjections: [], warnings: [] },
        }),
    })

    const plans = [makePlan({ id: "p1", isPrimary: true, yearOfBirth: 1980 })]

    const { result } = renderHook(() =>
      useCompositeProjection(plans, {
        yearOfBirth: 1980,
      } as unknown as import("types/independence").UserIndependenceSettings),
    )

    await act(async () => {
      jest.advanceTimersByTime(600)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.projection?.currentAge).toBe(47)
    expect(result.current.currentAge).toBe(47)
  })
})
