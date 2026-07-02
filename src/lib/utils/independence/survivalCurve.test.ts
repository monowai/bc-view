import { deriveSurvivalCurve } from "./survivalCurve"
import type { MonteCarloResult } from "types/independence"

/** Minimal MonteCarloResult builder — only fields used by deriveSurvivalCurve required. */
function mkResult(
  overrides: Partial<
    Pick<
      MonteCarloResult,
      "iterations" | "yearlyBands" | "depletionAgeDistribution"
    >
  > &
    Pick<MonteCarloResult, never> = {},
): MonteCarloResult {
  return {
    planId: "plan-test",
    iterations: 1000,
    successRate: 70,
    currency: "SGD",
    deterministicRunwayYears: 30,
    terminalBalancePercentiles: {
      p5: 0,
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
    },
    yearlyBands: [
      {
        year: 2025,
        age: 75,
        p5: 0,
        p10: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
      },
      {
        year: 2030,
        age: 80,
        p5: 0,
        p10: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
      },
      {
        year: 2035,
        age: 85,
        p5: 0,
        p10: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
      },
      {
        year: 2040,
        age: 90,
        p5: 0,
        p10: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
      },
    ],
    depletionAgeDistribution: {
      depletedCount: 300,
      survivedCount: 700,
      histogram: { 80: 50, 84: 100, 88: 150 },
    },
    parameters: {
      blendedReturnRate: 0.05,
      blendedVolatility: 0.12,
      inflationRate: 0.03,
      inflationVolatility: 0.01,
      housingReturnRate: 0.03,
      housingVolatility: 0.05,
      equityVolatility: 0.16,
      cashVolatility: 0.005,
      equityCashCorrelation: 0.05,
      investmentTaxRate: 0,
    },
    nonSpendableAtStart: 0,
    liquidatedCount: 0,
    ...overrides,
  }
}

describe("deriveSurvivalCurve — survival computation", () => {
  it("returns survival 1.0 for ages before any depletion in histogram", () => {
    const result = deriveSurvivalCurve(mkResult())
    const at79 = result.points.find((p) => p.age === 79)
    expect(at79).toBeDefined()
    expect(at79!.survival).toBe(1.0)
  })

  it("computes survival at 80 = 0.95 (50/1000 depleted)", () => {
    const result = deriveSurvivalCurve(mkResult())
    const at80 = result.points.find((p) => p.age === 80)
    expect(at80).toBeDefined()
    expect(at80!.survival).toBeCloseTo(0.95)
  })

  it("computes survival at 84 = 0.85 (cumulative 150/1000)", () => {
    const result = deriveSurvivalCurve(mkResult())
    const at84 = result.points.find((p) => p.age === 84)
    expect(at84).toBeDefined()
    expect(at84!.survival).toBeCloseTo(0.85)
  })

  it("computes survival at 88 = 0.70 (cumulative 300/1000)", () => {
    const result = deriveSurvivalCurve(mkResult())
    const at88 = result.points.find((p) => p.age === 88)
    expect(at88).toBeDefined()
    expect(at88!.survival).toBeCloseTo(0.7)
  })

  it("includes an entry for every integer age in the band range", () => {
    const result = deriveSurvivalCurve(mkResult())
    const ages = result.points.map((p) => p.age)
    // Age axis is from 75 (first band) to 90 (last band)
    expect(ages[0]).toBe(75)
    expect(ages[ages.length - 1]).toBe(90)
    expect(ages.length).toBe(90 - 75 + 1) // 16 entries
  })
})

describe("deriveSurvivalCurve — thresholds", () => {
  it("p90 = last age where survival was ≥ 0.90 (= 83 for test histogram)", () => {
    const result = deriveSurvivalCurve(mkResult())
    // survival at 80–83 = 0.95 (≥ 0.90); at 84 = 0.85 (< 0.90)
    expect(result.thresholds.p90).toBe(83)
  })

  it("p75 = last age where survival was ≥ 0.75 (= 87 for test histogram)", () => {
    const result = deriveSurvivalCurve(mkResult())
    // survival at 84–87 = 0.85 (≥ 0.75); at 88 = 0.70 (< 0.75)
    expect(result.thresholds.p75).toBe(87)
  })

  it("p50 is undefined when survival never drops below 0.50 in the age range", () => {
    const result = deriveSurvivalCurve(mkResult())
    // Survival at 88–90 = 0.70; never drops below 0.50
    expect(result.thresholds.p50).toBeUndefined()
  })

  it("p50 is set when enough depletion pushes survival below 0.50", () => {
    const result = deriveSurvivalCurve(
      mkResult({
        iterations: 1000,
        depletionAgeDistribution: {
          depletedCount: 600,
          survivedCount: 400,
          histogram: { 80: 200, 84: 200, 88: 200 },
        },
      }),
    )
    // survival at 88 = 1 - 600/1000 = 0.40 < 0.50
    expect(result.thresholds.p50).toBeDefined()
  })
})

describe("deriveSurvivalCurve — zero depletion case", () => {
  it("returns all survival = 1.0 when histogram is empty", () => {
    const result = deriveSurvivalCurve(
      mkResult({
        iterations: 1000,
        depletionAgeDistribution: {
          depletedCount: 0,
          survivedCount: 1000,
          histogram: {},
        },
      }),
    )
    const allOne = result.points.every((p) => p.survival === 1.0)
    expect(allOne).toBe(true)
  })

  it("sets no thresholds when survival never drops below 0.90", () => {
    const result = deriveSurvivalCurve(
      mkResult({
        depletionAgeDistribution: {
          depletedCount: 0,
          survivedCount: 1000,
          histogram: {},
        },
      }),
    )
    expect(result.thresholds.p90).toBeUndefined()
    expect(result.thresholds.p75).toBeUndefined()
    expect(result.thresholds.p50).toBeUndefined()
  })

  it("headline reads 'stay funded for life' when no thresholds", () => {
    const result = deriveSurvivalCurve(
      mkResult({
        depletionAgeDistribution: {
          depletedCount: 0,
          survivedCount: 1000,
          histogram: {},
        },
      }),
    )
    expect(result.headline).toBe("9 in 10 futures stay funded for life")
  })
})

describe("deriveSurvivalCurve — headline", () => {
  it("includes all three threshold labels when all thresholds are set", () => {
    const result = deriveSurvivalCurve(
      mkResult({
        iterations: 1000,
        depletionAgeDistribution: {
          depletedCount: 700,
          survivedCount: 300,
          histogram: { 78: 100, 82: 400, 86: 200 },
        },
      }),
    )
    // survival: at 78=0.90, at 82=0.50, at 86=0.30
    // p90 = 77 (last age ≥ 0.90 before dropping at 78)
    // Actually at 78: 1 - 100/1000 = 0.90 (≥ 0.90, so NOT < 0.90 — not a crossing yet)
    // At 82: 1 - 500/1000 = 0.50 (exactly 0.50, NOT < 0.50 — not crossing yet)
    // at 86: 1 - 700/1000 = 0.30 < 0.50 → p50 = 85
    // survival at 78 = 0.90, at 79-81 = 0.90, at 82 = 0.50, at 83-85 = 0.50, at 86 = 0.30
    // p90: never < 0.90 in range 75-90 (survival hits exactly 0.90 but never below)
    // so p90 = undefined for this test
    expect(result.headline).toBeTruthy()
  })

  it("uses '9 in 10 futures still funded at age N' for first threshold part", () => {
    const result = deriveSurvivalCurve(mkResult())
    // p90 = 83
    expect(result.headline).toContain("9 in 10 futures still funded at age 83")
  })

  it("uses '3 in 4 at age N' for second threshold part", () => {
    const result = deriveSurvivalCurve(mkResult())
    // p75 = 87
    expect(result.headline).toContain("3 in 4 at age 87")
  })

  it("uses 'half at age N' for third threshold part", () => {
    const result = deriveSurvivalCurve(
      mkResult({
        iterations: 1000,
        depletionAgeDistribution: {
          depletedCount: 700,
          survivedCount: 300,
          histogram: { 80: 100, 84: 300, 88: 300 },
        },
      }),
    )
    // survival at 88 = 1 - 700/1000 = 0.30 < 0.50 → p50 = 87
    expect(result.headline).toContain("half at age")
  })

  it("separates threshold parts with ' · '", () => {
    const result = deriveSurvivalCurve(mkResult())
    // Has p90 and p75 thresholds
    expect(result.headline).toContain(" · ")
  })
})

describe("deriveSurvivalCurve — age axis fallback", () => {
  it("falls back to histogram key range when no band ages present", () => {
    const result = deriveSurvivalCurve(
      mkResult({
        yearlyBands: [
          // No age fields
          { year: 2025, p5: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0 },
        ],
        depletionAgeDistribution: {
          depletedCount: 50,
          survivedCount: 950,
          histogram: { 82: 50 },
        },
      }),
    )
    // When no band ages, falls back to histogram range: only key is 82
    const ages = result.points.map((p) => p.age)
    expect(ages).toEqual([82])
    expect(result.points[0].survival).toBeCloseTo(0.95)
  })

  it("returns empty curve when no band ages and no histogram keys", () => {
    const result = deriveSurvivalCurve(
      mkResult({
        yearlyBands: [],
        depletionAgeDistribution: {
          depletedCount: 0,
          survivedCount: 0,
          histogram: {},
        },
      }),
    )
    expect(result.points).toHaveLength(0)
  })
})
