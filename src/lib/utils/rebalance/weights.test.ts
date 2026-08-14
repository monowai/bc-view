import {
  normalizeWeights,
  weightsSumValid,
  toWeightPercent,
  toWeightDecimal,
  buildPlanAssetsPayload,
  clampWeightPercent,
} from "./weights"
import { AssetWeightWithDetails } from "types/rebalance"

function sampleWeight(
  overrides: Partial<AssetWeightWithDetails> = {},
): AssetWeightWithDetails {
  return {
    assetId: "asset-1",
    assetCode: "US:VOO",
    assetName: "VANGUARD 500 INDEX FUND ETF SHARES",
    weight: 50,
    sortOrder: 0,
    ...overrides,
  }
}

describe("normalizeWeights", () => {
  it("scales weights proportionally so they sum to 100, rounded to 2dp", () => {
    const weights = [sampleWeight({ weight: 30 }), sampleWeight({ weight: 60 })]

    const result = normalizeWeights(weights, 90)

    expect(result).not.toBeNull()
    expect(result?.map((w) => w.weight)).toEqual([33.33, 66.67])
  })

  it("preserves every other field on each item", () => {
    const weights = [sampleWeight({ weight: 50, rationale: "core holding" })]

    const result = normalizeWeights(weights, 50)

    expect(result?.[0]).toMatchObject({
      assetId: "asset-1",
      assetCode: "US:VOO",
      rationale: "core holding",
    })
  })

  it("returns null (no-op) when totalWeight is 0, matching the original early-return", () => {
    const weights = [sampleWeight({ weight: 0 })]

    const result = normalizeWeights(weights, 0)

    expect(result).toBeNull()
  })

  it("returns null (no-op) when totalWeight is NaN", () => {
    const weights = [sampleWeight({ weight: 50 })]

    const result = normalizeWeights(weights, NaN)

    expect(result).toBeNull()
  })

  it("returns null (no-op) when totalWeight is Infinity", () => {
    const weights = [sampleWeight({ weight: 50 })]

    const result = normalizeWeights(weights, Infinity)

    expect(result).toBeNull()
  })

  it("returns the original array reference (via null-plus-guard) rather than mutating in place", () => {
    const weights = [sampleWeight({ weight: 100 })]

    const result = normalizeWeights(weights, 100)

    expect(result).not.toBe(weights)
    expect(result?.[0]).not.toBe(weights[0])
  })

  it("distributes the remaining hundredths by largest remainder so three equal weights sum to exactly 100.00, not 99.99", () => {
    const weights = [
      sampleWeight({ assetId: "a1", weight: 33.33 }),
      sampleWeight({ assetId: "a2", weight: 33.33 }),
      sampleWeight({ assetId: "a3", weight: 33.33 }),
    ]

    const result = normalizeWeights(weights, 99.99)

    expect(result?.map((w) => w.weight)).toEqual([33.34, 33.33, 33.33])
    expect(result?.reduce((sum, w) => sum + w.weight, 0)).toBeCloseTo(100, 10)
  })

  it("allocates remaining hundredths to the items with the largest fractional remainder, not by row order", () => {
    // factor = 100/99.98; exact cents work out to 1000.20004, 2000.40008,
    // 3000.60012, 3998.79976 — remainders (desc) are item4 > item3 > item2 >
    // item1, so the 2 leftover cents go to item4 then item3, NOT item1/item2.
    const weights = [
      sampleWeight({ assetId: "a1", weight: 10 }),
      sampleWeight({ assetId: "a2", weight: 20 }),
      sampleWeight({ assetId: "a3", weight: 30 }),
      sampleWeight({ assetId: "a4", weight: 39.98 }),
    ]

    const result = normalizeWeights(weights, 99.98)

    expect(result?.map((w) => w.weight)).toEqual([10, 20, 30.01, 39.99])
    expect(result?.reduce((sum, w) => sum + w.weight, 0)).toBeCloseTo(100, 10)
  })

  it("breaks a remainder tie by original index, giving the extra hundredth to the earliest item", () => {
    // 7 equal weights of 1 (total 7): each scales to 1428.571..., so every
    // item ties on remainder — the 4 leftover cents must land on indices
    // 0-3, not some other subset.
    const weights = Array.from({ length: 7 }, (_, i) =>
      sampleWeight({ assetId: `a${i}`, weight: 1 }),
    )

    const result = normalizeWeights(weights, 7)

    expect(result?.map((w) => w.weight)).toEqual([
      14.29, 14.29, 14.29, 14.29, 14.28, 14.28, 14.28,
    ])
    expect(result?.reduce((sum, w) => sum + w.weight, 0)).toBeCloseTo(100, 10)
  })
})

describe("weightsSumValid", () => {
  it("is true when the total is within 0.01 of 100", () => {
    expect(weightsSumValid(100)).toBe(true)
    expect(weightsSumValid(100.005)).toBe(true)
    expect(weightsSumValid(99.995)).toBe(true)
  })

  it("is false once the total drifts 0.01 or more from 100", () => {
    expect(weightsSumValid(100.01)).toBe(false)
    expect(weightsSumValid(99.98)).toBe(false)
    expect(weightsSumValid(0)).toBe(false)
  })
})

describe("toWeightPercent", () => {
  it("converts a decimal ratio to a percentage rounded to 2dp", () => {
    expect(toWeightPercent(0.3333)).toBe(33.33)
    expect(toWeightPercent(1)).toBe(100)
    expect(toWeightPercent(0)).toBe(0)
  })
})

describe("toWeightDecimal", () => {
  it("converts a percentage to a decimal ratio", () => {
    expect(toWeightDecimal(33.33)).toBe(0.3333)
    expect(toWeightDecimal(100)).toBe(1)
    expect(toWeightDecimal(0)).toBe(0)
  })
})

describe("toWeightPercent / toWeightDecimal round-trip", () => {
  it("round-trips a decimal through percent and back", () => {
    const decimal = 0.4567
    expect(toWeightDecimal(toWeightPercent(decimal))).toBeCloseTo(decimal, 4)
  })
})

describe("buildPlanAssetsPayload", () => {
  it("maps percent weights to decimals and defaults sortOrder to array index", () => {
    const weights = [
      sampleWeight({
        assetId: "a1",
        weight: 60,
        assetCode: "US:VOO",
        assetName: "Vanguard",
        capturedPrice: 123.45,
        priceCurrency: "USD",
        rationale: "core",
        sortOrder: undefined,
      }),
      sampleWeight({ assetId: "a2", weight: 40, sortOrder: undefined }),
    ]

    const payload = buildPlanAssetsPayload(weights)

    expect(payload).toEqual({
      assets: [
        {
          assetId: "a1",
          weight: 0.6,
          assetCode: "US:VOO",
          assetName: "Vanguard",
          capturedPrice: 123.45,
          priceCurrency: "USD",
          rationale: "core",
          sortOrder: 0,
        },
        {
          assetId: "a2",
          weight: 0.4,
          assetCode: "US:VOO",
          assetName: "VANGUARD 500 INDEX FUND ETF SHARES",
          capturedPrice: undefined,
          priceCurrency: undefined,
          rationale: undefined,
          sortOrder: 1,
        },
      ],
    })
  })

  it("preserves an explicit sortOrder instead of the array index", () => {
    const weights = [sampleWeight({ assetId: "a1", weight: 100, sortOrder: 7 })]

    const payload = buildPlanAssetsPayload(weights)

    expect(payload.assets[0].sortOrder).toBe(7)
  })

  it("turns an empty rationale string into undefined (falsy-coalesce, verbatim)", () => {
    const weights = [sampleWeight({ rationale: "" })]

    const payload = buildPlanAssetsPayload(weights)

    expect(payload.assets[0].rationale).toBeUndefined()
  })
})

describe("clampWeightPercent", () => {
  it("passes through an in-range value unchanged", () => {
    expect(clampWeightPercent(42.5)).toBe(42.5)
    expect(clampWeightPercent(0)).toBe(0)
    expect(clampWeightPercent(100)).toBe(100)
  })

  it("clamps a value above 100 down to 100", () => {
    expect(clampWeightPercent(500)).toBe(100)
    expect(clampWeightPercent(100.01)).toBe(100)
  })

  it("clamps a negative value up to 0", () => {
    expect(clampWeightPercent(-5)).toBe(0)
  })

  it("treats NaN as 0", () => {
    expect(clampWeightPercent(NaN)).toBe(0)
  })

  it("treats Infinity and -Infinity as 0", () => {
    expect(clampWeightPercent(Infinity)).toBe(0)
    expect(clampWeightPercent(-Infinity)).toBe(0)
  })
})
