import { act, renderHook } from "@testing-library/react"
import type {
  RetirementPlan,
  UserIndependenceSettings,
} from "types/independence"
import { useScenario } from "../useScenario"

const plan: RetirementPlan = {
  id: "p1",
  ownerId: "u1",
  name: "Test",
  planningHorizonYears: 30,
  lifeExpectancy: 90,
  monthlyExpenses: 5000,
  expensesCurrency: "SGD",
  cashReturnRate: 0.03,
  equityReturnRate: 0.07,
  housingReturnRate: 0.04,
  inflationRate: 0.025,
  cashAllocation: 0.3,
  equityAllocation: 0.7,
  housingAllocation: 0,
  pensionMonthly: 800,
  socialSecurityMonthly: 200,
  otherIncomeMonthly: 100,
  workingIncomeMonthly: 0,
  workingExpensesMonthly: 0,
  taxesMonthly: 0,
  bonusMonthly: 0,
  investmentAllocationPercent: 0.8,
  isPrimary: true,
  createdDate: "2026-01-01",
  updatedDate: "2026-01-01",
}

const settings: UserIndependenceSettings = {
  id: "s1",
  ownerId: "u1",
  yearOfBirth: 1980,
  targetIndependenceAge: 60,
  lifeExpectancy: 92,
  createdDate: "2026-01-01",
  updatedDate: "2026-01-01",
}

describe("useScenario", () => {
  it("seeds from plan + settings on first render", () => {
    const { result } = renderHook(() => useScenario(plan, settings))
    expect(result.current.scenario.retirementAge).toBe(60)
    expect(result.current.scenario.monthlyExpenses).toBe(5000)
    expect(result.current.scenario.pensionMonthly).toBe(800)
    expect(result.current.isDirty).toBe(false)
  })

  it("patches a single field via setScenario without losing others", () => {
    const { result } = renderHook(() => useScenario(plan, settings))
    act(() => {
      result.current.setScenario({ retirementAge: 55 })
    })
    expect(result.current.scenario.retirementAge).toBe(55)
    expect(result.current.scenario.monthlyExpenses).toBe(5000)
    expect(result.current.isDirty).toBe(true)
  })

  it("reset restores seeded values", () => {
    const { result } = renderHook(() => useScenario(plan, settings))
    act(() => {
      result.current.setScenario({
        retirementAge: 55,
        liquidAssets: 100_000,
      })
    })
    expect(result.current.isDirty).toBe(true)
    act(() => result.current.reset())
    expect(result.current.scenario.retirementAge).toBe(60)
    expect(result.current.scenario.liquidAssets).toBeNull()
    expect(result.current.isDirty).toBe(false)
  })

  it("does NOT re-seed when plan reference changes after initial seed", () => {
    // User in mid-edit; a save reloads `plan` with new updatedDate. We must
    // preserve the user's slider changes.
    const { result, rerender } = renderHook(
      ({ p }: { p: RetirementPlan }) => useScenario(p, settings),
      { initialProps: { p: plan } },
    )
    act(() => result.current.setScenario({ retirementAge: 55 }))
    rerender({ p: { ...plan, updatedDate: "2026-02-01" } })
    expect(result.current.scenario.retirementAge).toBe(55)
  })
})
