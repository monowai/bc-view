import type {
  RetirementPlan,
  UserIndependenceSettings,
} from "types/independence"
import { isScenarioDirty, seedFromPlan } from "../seedFromPlan"
import { DEFAULT_SCENARIO_STATE } from "../types"

const plan: RetirementPlan = {
  id: "p1",
  ownerId: "u1",
  name: "Test plan",
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

describe("seedFromPlan", () => {
  it("returns DEFAULT_SCENARIO_STATE when plan is undefined", () => {
    expect(seedFromPlan(undefined, settings)).toEqual(DEFAULT_SCENARIO_STATE)
  })

  it("seeds ages from settings + currentYear", () => {
    const seed = seedFromPlan(plan, settings, 2026)
    expect(seed.currentAge).toBe(46) // 2026 - 1980
    expect(seed.retirementAge).toBe(60)
    expect(seed.lifeExpectancy).toBe(92)
  })

  it("falls back to plan.lifeExpectancy when settings lacks one", () => {
    const partial: UserIndependenceSettings = {
      ...settings,
      lifeExpectancy: 0,
    }
    // settings.lifeExpectancy is 0 (falsy) — should fall back
    const seed = seedFromPlan(plan, {
      ...partial,
      lifeExpectancy: undefined as unknown as number,
    })
    expect(seed.lifeExpectancy).toBe(90)
  })

  it("zeroes currentAge when yearOfBirth is missing", () => {
    const seed = seedFromPlan(plan, { ...settings, yearOfBirth: undefined })
    expect(seed.currentAge).toBe(0)
  })

  it("seeds pension, social security and other income as separate fields", () => {
    const seed = seedFromPlan(plan, settings, 2026)
    expect(seed.pensionMonthly).toBe(800)
    expect(seed.socialSecurityMonthly).toBe(200)
    expect(seed.otherIncomeMonthly).toBe(100)
  })

  it("leaves liquidAssets and realReturn null to signal 'derive from plan'", () => {
    const seed = seedFromPlan(plan, settings, 2026)
    expect(seed.liquidAssets).toBeNull()
    expect(seed.realReturn).toBeNull()
  })

  it("seeds monthlyExpenses + inflation from plan", () => {
    const seed = seedFromPlan(plan, settings, 2026)
    expect(seed.monthlyExpenses).toBe(5000)
    expect(seed.inflation).toBe(0.025)
  })
})

describe("isScenarioDirty", () => {
  it("returns false for an unmodified seeded scenario", () => {
    const seed = seedFromPlan(plan, settings, 2026)
    expect(isScenarioDirty(seed, plan, settings, 2026)).toBe(false)
  })

  it("returns true when retirementAge changes", () => {
    const seed = seedFromPlan(plan, settings, 2026)
    expect(
      isScenarioDirty({ ...seed, retirementAge: 55 }, plan, settings, 2026),
    ).toBe(true)
  })

  it("returns true when liquidAssets overridden (non-null)", () => {
    const seed = seedFromPlan(plan, settings, 2026)
    expect(
      isScenarioDirty({ ...seed, liquidAssets: 100000 }, plan, settings, 2026),
    ).toBe(true)
  })

  it("returns true when realReturn overridden (non-null)", () => {
    const seed = seedFromPlan(plan, settings, 2026)
    expect(
      isScenarioDirty({ ...seed, realReturn: 0.05 }, plan, settings, 2026),
    ).toBe(true)
  })

  it("returns true when monthlyExpenses, pensionMonthly, or inflation change", () => {
    const seed = seedFromPlan(plan, settings, 2026)
    expect(
      isScenarioDirty({ ...seed, monthlyExpenses: 6000 }, plan, settings, 2026),
    ).toBe(true)
    expect(
      isScenarioDirty({ ...seed, pensionMonthly: 1000 }, plan, settings, 2026),
    ).toBe(true)
    expect(
      isScenarioDirty({ ...seed, inflation: 0.03 }, plan, settings, 2026),
    ).toBe(true)
  })
})
