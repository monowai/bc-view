import type { RetirementPlan } from "types/independence"
import {
  applyRealReturn,
  blendedReturnRate,
  scenarioToPayload,
  type ScenarioPayloadCtx,
} from "../scenarioToPayload"
import type { ScenarioState } from "../types"

const plan: RetirementPlan = {
  id: "p1",
  ownerId: "u1",
  name: "Test plan",
  planningHorizonYears: 30,
  lifeExpectancy: 90,
  monthlyExpenses: 5000,
  expensesCurrency: "SGD",
  targetBalance: 1_500_000,
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

const scenario: ScenarioState = {
  currentAge: 46,
  retirementAge: 60,
  lifeExpectancy: 92,
  liquidAssets: null,
  monthlyExpenses: 5000,
  pensionMonthly: 800,
  otherIncomeMonthly: 300,
  realReturn: null,
  inflation: 0.025,
}

const ctx: ScenarioPayloadCtx = {
  plan,
  selectedPortfolioIds: [],
  displayCurrency: "SGD",
  monthlyInvestment: 2000,
  derivedLiquidAssets: 250_000,
  derivedNonSpendableAssets: 600_000,
}

describe("scenarioToPayload", () => {
  it("seeds derived asset totals when scenario liquidAssets is null", () => {
    const payload = scenarioToPayload(scenario, ctx)
    expect(payload.liquidAssets).toBe(250_000)
    expect(payload.nonSpendableAssets).toBe(600_000)
  })

  it("uses scenario liquidAssets override when non-null", () => {
    const payload = scenarioToPayload(
      { ...scenario, liquidAssets: 400_000 },
      ctx,
    )
    expect(payload.liquidAssets).toBe(400_000)
  })

  it("collapses SS into otherIncomeMonthly and zeroes socialSecurityMonthly", () => {
    const payload = scenarioToPayload(scenario, ctx)
    expect(payload.otherIncomeMonthly).toBe(300)
    expect(payload.socialSecurityMonthly).toBe(0)
  })

  it("threads age + lifeExpectancy + retirementAge straight through", () => {
    const payload = scenarioToPayload(scenario, ctx)
    expect(payload.currentAge).toBe(46)
    expect(payload.retirementAge).toBe(60)
    expect(payload.lifeExpectancy).toBe(92)
  })

  it("passes plan return rates unchanged when realReturn is null", () => {
    const payload = scenarioToPayload(scenario, ctx)
    expect(payload.cashReturnRate).toBe(0.03)
    expect(payload.equityReturnRate).toBe(0.07)
    expect(payload.housingReturnRate).toBe(0.04)
  })

  it("shifts cash + equity by delta when realReturn is set, leaves housing alone", () => {
    // Plan blended: 0.3*0.03 + 0.7*0.07 = 0.058. Inflation 0.025 → plan real = 0.033.
    // Slider real = 0.05 → target nominal = 0.075 → delta = +0.017.
    const payload = scenarioToPayload({ ...scenario, realReturn: 0.05 }, ctx)
    expect(payload.cashReturnRate).toBeCloseTo(0.047, 5)
    expect(payload.equityReturnRate).toBeCloseTo(0.087, 5)
    expect(payload.housingReturnRate).toBe(0.04)
  })

  it("includes definedContribution when provided", () => {
    const payload = scenarioToPayload(scenario, {
      ...ctx,
      definedContribution: 500,
    })
    expect(payload.definedContribution).toBe(500)
  })

  it("omits definedContribution when not provided", () => {
    const payload = scenarioToPayload(scenario, ctx)
    expect("definedContribution" in payload).toBe(false)
  })

  it("includes rentalIncomeMonthly when rentalIncome has a positive total", () => {
    const payload = scenarioToPayload(scenario, {
      ...ctx,
      rentalIncome: {
        monthlyNetByCurrency: { SGD: 1500 },
        totalMonthlyInPlanCurrency: 1500,
      },
    })
    expect(payload.rentalIncomeMonthly).toBe(1500)
  })

  it("omits rentalIncomeMonthly when total is zero", () => {
    const payload = scenarioToPayload(scenario, {
      ...ctx,
      rentalIncome: {
        monthlyNetByCurrency: {},
        totalMonthlyInPlanCurrency: 0,
      },
    })
    expect("rentalIncomeMonthly" in payload).toBe(false)
  })
})

describe("blendedReturnRate", () => {
  it("computes weighted average of cash + equity, normalised by investable", () => {
    expect(blendedReturnRate(plan)).toBeCloseTo(0.058, 5)
  })

  it("returns zero when investable allocation is zero", () => {
    expect(
      blendedReturnRate({ ...plan, cashAllocation: 0, equityAllocation: 0 }),
    ).toBe(0)
  })
})

describe("applyRealReturn", () => {
  it("returns plan rates unchanged when realReturn is null", () => {
    const r = applyRealReturn(scenario, plan)
    expect(r.cashReturnRate).toBe(0.03)
    expect(r.equityReturnRate).toBe(0.07)
    expect(r.housingReturnRate).toBe(0.04)
  })

  it("applies a uniform delta to cash + equity when realReturn is set", () => {
    const r = applyRealReturn({ ...scenario, realReturn: 0.04 }, plan)
    // delta = (0.04 + 0.025) - 0.058 = 0.007
    expect(r.cashReturnRate).toBeCloseTo(0.037, 5)
    expect(r.equityReturnRate).toBeCloseTo(0.077, 5)
    expect(r.housingReturnRate).toBe(0.04)
  })
})
