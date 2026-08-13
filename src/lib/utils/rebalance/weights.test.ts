import {
  normalizeWeights,
  weightsSumValid,
  toWeightPercent,
  toWeightDecimal,
  buildPlanAssetsPayload,
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
