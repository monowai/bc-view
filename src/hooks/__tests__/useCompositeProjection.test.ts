import { buildInitialPhases } from "../useCompositeProjection"
import type { RetirementPlan } from "types/independence"

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
    const plans = [
      makePlan({ id: "p1" }),
      makePlan({ id: "p2" }),
    ]
    const phases = buildInitialPhases(plans, new Set(), 60, 90)

    expect(phases[phases.length - 1].toAge).toBeUndefined()
  })
})
