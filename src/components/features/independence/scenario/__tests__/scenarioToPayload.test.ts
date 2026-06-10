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
  socialSecurityMonthly: 200,
  otherIncomeMonthly: 100,
  realReturn: null,
  inflation: 0.025,
  cashToInvestPercent: 0,
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

  it("passes pension, SS and other income through as separate fields", () => {
    const payload = scenarioToPayload(scenario, ctx)
    expect(payload.pensionMonthly).toBe(800)
    expect(payload.socialSecurityMonthly).toBe(200)
    expect(payload.otherIncomeMonthly).toBe(100)
  })

  it("threads age + lifeExpectancy + retirementAge straight through", () => {
    const payload = scenarioToPayload(scenario, ctx)
    expect(payload.currentAge).toBe(46)
    expect(payload.retirementAge).toBe(60)
    expect(payload.lifeExpectancy).toBe(92)
  })

  it("omits age / retirementAge / lifeExpectancy when isSharedPlan is true", () => {
    // Regression: those fields seed from the VIEWER'S UserIndependenceSettings.
    // Sending them on a shared plan made svc-retire's StartingStateResolver
    // skip the plan-owner settings fallback, so the projection used the
    // viewer's retirement timeline instead of the owner's.
    const payload = scenarioToPayload(scenario, {
      ...ctx,
      isSharedPlan: true,
    })
    expect(payload.currentAge).toBeUndefined()
    expect(payload.retirementAge).toBeUndefined()
    expect(payload.lifeExpectancy).toBeUndefined()
  })

  it("omits portfolioIds / monthlyContribution / rentalIncomeMonthly when isSharedPlan", () => {
    // Regression: those values come from the VIEWER'S holdings, contributions
    // and PrivateAssetConfig entries. Sending them on a shared plan made
    // svc-retire run the projection against Mike's 9 portfolios + Mike's
    // rental income instead of the owner's M2M-resolved data.
    const payload = scenarioToPayload(scenario, {
      ...ctx,
      isSharedPlan: true,
      rentalIncome: {
        monthlyNetByCurrency: { SGD: 1500 },
        totalMonthlyInPlanCurrency: 1500,
      },
    })
    expect("portfolioIds" in payload).toBe(false)
    expect("monthlyContribution" in payload).toBe(false)
    expect("rentalIncomeMonthly" in payload).toBe(false)
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

  describe("cashToInvestPercent slider", () => {
    it("omits allocation overrides when the slider is at zero", () => {
      const payload = scenarioToPayload(scenario, ctx)
      expect("cashAllocation" in payload).toBe(false)
      expect("equityAllocation" in payload).toBe(false)
    })

    it("shifts half the cash into equity at 50%", () => {
      // Plan: cash 0.3, equity 0.7. Slider 50 → move 0.15 of cash into equity.
      // New cash 0.15, new equity 0.85.
      const payload = scenarioToPayload(
        { ...scenario, cashToInvestPercent: 50 },
        ctx,
      )
      expect(payload.cashAllocation).toBeCloseTo(0.15, 5)
      expect(payload.equityAllocation).toBeCloseTo(0.85, 5)
    })

    it("zeros the cash allocation at 100%", () => {
      const payload = scenarioToPayload(
        { ...scenario, cashToInvestPercent: 100 },
        ctx,
      )
      expect(payload.cashAllocation).toBeCloseTo(0, 5)
      expect(payload.equityAllocation).toBeCloseTo(1, 5)
    })

    it("clamps negative slider values to no shift", () => {
      const payload = scenarioToPayload(
        { ...scenario, cashToInvestPercent: -10 },
        ctx,
      )
      expect("cashAllocation" in payload).toBe(false)
    })

    it("clamps above 100 to a full shift", () => {
      const payload = scenarioToPayload(
        { ...scenario, cashToInvestPercent: 250 },
        ctx,
      )
      expect(payload.cashAllocation).toBeCloseTo(0, 5)
      expect(payload.equityAllocation).toBeCloseTo(1, 5)
    })
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
