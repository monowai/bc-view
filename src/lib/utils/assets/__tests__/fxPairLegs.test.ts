import { fxPairLegs } from "@lib/assets/assetUtils"
import { makeAsset } from "@test-fixtures/beancounter"

const fx = (code: string): ReturnType<typeof makeAsset> =>
  makeAsset({
    code,
    assetCategory: { id: "CURRENCY", name: "Currency" },
    market: { code: "FX", name: "FX" } as never,
  })

describe("fxPairLegs", () => {
  it("splits a six-letter pair into base and quote", () => {
    expect(fxPairLegs(fx("NZDSGD"))).toEqual({ from: "NZD", to: "SGD" })
  })

  it("strips an owner prefix before splitting", () => {
    expect(fxPairLegs(fx("abcdefghijklmnopqrstuv.USDJPY"))).toEqual({
      from: "USD",
      to: "JPY",
    })
  })

  it("is null off the FX market", () => {
    expect(fxPairLegs(makeAsset({ code: "NZDSGD" }))).toBeNull()
  })

  it("is null for a code that is not a six-letter pair", () => {
    expect(fxPairLegs(fx("NZD"))).toBeNull()
    expect(fxPairLegs(fx("NZD/SGD"))).toBeNull()
    expect(fxPairLegs(fx("NZDSGD1"))).toBeNull()
  })

  it("is null without an asset", () => {
    expect(fxPairLegs(null)).toBeNull()
    expect(fxPairLegs(undefined)).toBeNull()
  })
})
