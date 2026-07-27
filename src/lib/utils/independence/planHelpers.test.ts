import { LifeEvent, RetirementPlan } from "types/independence"
import {
  normalizeAllocation,
  serializeLifeEvents,
  toPlanRequestPayload,
} from "./planHelpers"

const plan: RetirementPlan = {
  id: "p1",
  ownerId: "u1",
  name: "Test plan",
  planningHorizonYears: 30,
  lifeExpectancy: 90,
  monthlyExpenses: 5000,
  expensesCurrency: "NZD",
  targetBalance: 1_500_000,
  cashReturnRate: 0.03,
  equityReturnRate: 0.07,
  housingReturnRate: 0.04,
  inflationRate: 0.025,
  feeRate: 0.001,
  investmentTaxRate: 0.28,
  cashAllocation: 0.3,
  equityAllocation: 0.7,
  housingAllocation: 0,
  pensionMonthly: 800,
  socialSecurityMonthly: 200,
  benefitsStartAge: 67,
  otherIncomeMonthly: 100,
  workingIncomeMonthly: 500,
  workingExpensesMonthly: 200,
  taxesMonthly: 50,
  bonusMonthly: 25,
  investmentAllocationPercent: 0.8,
  lifeEvents: undefined,
  excludedPortfolioIds: ["pf-1"],
  excludedRentalAssetIds: ["ra-1"],
  country: "NZ",
  narrative: "Retire early",
  primaryStrategy: "FIRE",
  headlineMetric: "INCOME_COVERAGE",
  isPrimary: true,
  createdDate: "2026-01-01",
  updatedDate: "2026-01-01",
} as RetirementPlan

describe("toPlanRequestPayload", () => {
  it("echoes every mutable plan field the backend PlanRequest expects", () => {
    const payload = toPlanRequestPayload(plan)
    expect(payload).toMatchObject({
      name: "Test plan",
      planningHorizonYears: 30,
      monthlyExpenses: 5000,
      expensesCurrency: "NZD",
      targetBalance: 1_500_000,
      cashReturnRate: 0.03,
      equityReturnRate: 0.07,
      housingReturnRate: 0.04,
      inflationRate: 0.025,
      feeRate: 0.001,
      investmentTaxRate: 0.28,
      cashAllocation: 0.3,
      equityAllocation: 0.7,
      housingAllocation: 0,
      pensionMonthly: 800,
      socialSecurityMonthly: 200,
      benefitsStartAge: 67,
      otherIncomeMonthly: 100,
      workingIncomeMonthly: 500,
      workingExpensesMonthly: 200,
      taxesMonthly: 50,
      bonusMonthly: 25,
      investmentAllocationPercent: 0.8,
      excludedPortfolioIds: ["pf-1"],
      excludedRentalAssetIds: ["ra-1"],
      country: "NZ",
      narrative: "Retire early",
      primaryStrategy: "FIRE",
      headlineMetric: "INCOME_COVERAGE",
    })
  })

  it("null-coalesces optional fields that are absent on the plan", () => {
    const payload = toPlanRequestPayload({
      ...plan,
      targetBalance: undefined,
      benefitsStartAge: undefined,
      lifeEvents: undefined,
      country: undefined,
      narrative: undefined,
      primaryStrategy: undefined,
      headlineMetric: undefined,
      excludedPortfolioIds: undefined,
      excludedRentalAssetIds: undefined,
    })
    expect(payload.targetBalance).toBeNull()
    expect(payload.benefitsStartAge).toBeNull()
    expect(payload.lifeEvents).toBeNull()
    expect(payload.country).toBeNull()
    expect(payload.narrative).toBeNull()
    expect(payload.primaryStrategy).toBeNull()
    expect(payload.headlineMetric).toBeNull()
    // Exclusions null-coalesce to an empty array, not null — see
    // parseExcludedPortfolioIds/parseExcludedRentalAssetIds.
    expect(payload.excludedPortfolioIds).toEqual([])
    expect(payload.excludedRentalAssetIds).toEqual([])
  })

  it("defaults feeRate/investmentTaxRate to 0 when absent, distinct from an explicit 0", () => {
    const payload = toPlanRequestPayload({
      ...plan,
      feeRate: undefined,
      investmentTaxRate: undefined,
    })
    expect(payload.feeRate).toBe(0)
    expect(payload.investmentTaxRate).toBe(0)
  })

  it("parses excludedPortfolioIds / excludedRentalAssetIds from a JSON string", () => {
    const payload = toPlanRequestPayload({
      ...plan,
      excludedPortfolioIds: JSON.stringify(["pf-9"]),
      excludedRentalAssetIds: JSON.stringify(["ra-9"]),
    } as unknown as RetirementPlan)
    expect(payload.excludedPortfolioIds).toEqual(["pf-9"])
    expect(payload.excludedRentalAssetIds).toEqual(["ra-9"])
  })
})

describe("normalizeAllocation", () => {
  it("returns values summing to 100 when CPF reduces raw sum below 100", () => {
    // e.g. equity=42, cash=18, housing=10 → raw sum 70 (CPF holds 30%)
    const result = normalizeAllocation(42, 18, 10)
    expect(result.equity + result.cash + result.housing).toBe(100)
    expect(result.equity).toBe(60) // 42/70 * 100
    expect(result.cash).toBe(26) // 18/70 * 100
    expect(result.housing).toBe(14) // remainder
  })

  it("returns unchanged integers when values already sum to 100", () => {
    const result = normalizeAllocation(60, 30, 10)
    expect(result).toEqual({ equity: 60, cash: 30, housing: 10 })
  })

  it("returns zeros when all inputs are zero", () => {
    expect(normalizeAllocation(0, 0, 0)).toEqual({
      equity: 0,
      cash: 0,
      housing: 0,
    })
  })
})

describe("serializeLifeEvents", () => {
  it("serialises a populated array as a JSON string the backend can parse", () => {
    const events: LifeEvent[] = [
      {
        id: "a",
        age: 62,
        amount: 60000,
        description: "tax",
        eventType: "expense",
      },
    ]
    expect(serializeLifeEvents(events)).toBe(JSON.stringify(events))
  })

  it("returns the empty-array JSON literal '[]' when no events remain", () => {
    // Regression: previously the wizard sent `undefined` once the user
    // deleted the last (or only) life event. The backend's PATCH semantics
    // treat null/missing as "no change", so the deleted event came back on
    // refresh. Sending an explicit "[]" tells svc-retire to clear the list.
    expect(serializeLifeEvents([])).toBe("[]")
  })

  it("treats undefined as an empty list and serialises '[]'", () => {
    expect(serializeLifeEvents(undefined)).toBe("[]")
  })
})
