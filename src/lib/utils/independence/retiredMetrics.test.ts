import {
  isJourneyRetired,
  isRetired,
  plannedAnnualDrawdown,
  withdrawalGuardrail,
  moneyLastsTo,
} from "./retiredMetrics"
import { makeCompositeProjection } from "@test-fixtures/independence"
import type {
  RetirementProjection,
  YearlyPercentileBand,
} from "types/independence"

const projection = (
  overrides: Partial<RetirementProjection> = {},
): RetirementProjection =>
  ({
    planId: "p1",
    asOfDate: "2026-11-19",
    totalAssets: 1_200_000,
    liquidAssets: 1_000_000,
    monthlyExpenses: 5000,
    runwayMonths: 0,
    runwayYears: 0,
    currency: "NZD",
    yearlyProjections: [],
    nonSpendableAtRetirement: 0,
    housingReturnRate: 0.03,
    ...overrides,
  }) as RetirementProjection

const band = (age: number, p10: number, p50: number): YearlyPercentileBand => ({
  year: 2026 + (age - 65),
  age,
  p5: p10,
  p10,
  p25: p50,
  p50,
  p75: p50,
  p90: p50,
  p95: p50,
})

describe("isRetired", () => {
  it("is true once current age reaches the plan's retirement age", () => {
    expect(
      isRetired(
        projection({
          planInputs: { currentAge: 65, retirementAge: 65 } as never,
        }),
      ),
    ).toBe(true)
  })

  it("is false while the owner is still short of retirement age", () => {
    expect(
      isRetired(
        projection({
          planInputs: { currentAge: 58, retirementAge: 65 } as never,
        }),
      ),
    ).toBe(false)
  })

  it("is false when the ages are unknown", () => {
    expect(isRetired(projection())).toBe(false)
    expect(isRetired(null)).toBe(false)
  })
})

describe("plannedAnnualDrawdown", () => {
  it("reads this year's planned withdrawal from the projection", () => {
    const p = projection({
      yearlyProjections: [
        { year: 2026, withdrawals: 42_000 },
        { year: 2027, withdrawals: 43_000 },
      ] as never,
    })
    expect(plannedAnnualDrawdown(p)).toBe(42_000)
  })

  it("reads the current age's row when retirement began years ago", () => {
    const p = projection({
      planInputs: { currentAge: 66, retirementAge: 60 } as never,
      yearlyProjections: [
        { year: 2020, age: 60, withdrawals: 36_000 },
        { year: 2026, age: 66, withdrawals: 42_000 },
      ] as never,
    })
    expect(plannedAnnualDrawdown(p)).toBe(42_000)
  })

  it("is zero when the projection has no years", () => {
    expect(plannedAnnualDrawdown(projection())).toBe(0)
  })
})

describe("withdrawalGuardrail", () => {
  it("is on track within 20% of the planned drawdown", () => {
    const g = withdrawalGuardrail(44_000, 40_000, 1_000_000)
    expect(g.band).toBe("onTrack")
    expect(g.actualRate).toBeCloseTo(4.4)
    expect(g.plannedRate).toBeCloseTo(4.0)
  })

  it("flags drawing more than 20% over plan", () => {
    expect(withdrawalGuardrail(50_000, 40_000, 1_000_000).band).toBe("over")
  })

  it("shows room to spend when more than 20% under plan", () => {
    expect(withdrawalGuardrail(30_000, 40_000, 1_000_000).band).toBe("under")
  })

  it("has no band when the plan draws nothing or there are no liquid assets", () => {
    expect(withdrawalGuardrail(10_000, 0, 1_000_000).band).toBe("none")
    expect(withdrawalGuardrail(10_000, 40_000, 0).band).toBe("none")
  })
})

describe("moneyLastsTo", () => {
  it("finds the first age each percentile path runs dry", () => {
    const bands = [
      band(65, 900_000, 1_000_000),
      band(80, 100_000, 700_000),
      band(84, 0, 500_000),
      band(95, 0, 0),
    ]
    expect(moneyLastsTo(bands)).toEqual({ median: 95, badCase: 84 })
  })

  it("is null for a path that never runs dry", () => {
    const bands = [band(65, 900_000, 1_000_000), band(95, 50_000, 800_000)]
    expect(moneyLastsTo(bands)).toEqual({ median: null, badCase: null })
  })
})

describe("isJourneyRetired", () => {
  it("is retired once the owner has reached the journey's retirement age", () => {
    expect(
      isJourneyRetired(
        makeCompositeProjection({ currentAge: 66, retirementAge: 65 }),
      ),
    ).toBe(true)
    expect(
      isJourneyRetired(
        makeCompositeProjection({ currentAge: 65, retirementAge: 65 }),
      ),
    ).toBe(true)
  })

  it("is not retired before the retirement age", () => {
    expect(
      isJourneyRetired(
        makeCompositeProjection({ currentAge: 58, retirementAge: 65 }),
      ),
    ).toBe(false)
  })

  it("is not retired when the backend sent no ages, or no projection", () => {
    expect(isJourneyRetired(makeCompositeProjection())).toBe(false)
    expect(isJourneyRetired(makeCompositeProjection({ currentAge: 66 }))).toBe(
      false,
    )
    expect(
      isJourneyRetired(makeCompositeProjection({ retirementAge: 65 })),
    ).toBe(false)
    expect(isJourneyRetired(null)).toBe(false)
  })
})
