import { isWatchable, toAssetCategoryId } from "@lib/assets/assetUtils"
import { makeAsset } from "@test-fixtures/beancounter"

describe("isWatchable", () => {
  it("excludes private assets given a market object", () => {
    expect(
      isWatchable(
        makeAsset({
          market: { code: "PRIVATE", name: "Private" } as never,
        }),
      ),
    ).toBe(false)
  })

  it("excludes private assets given a market code string", () => {
    expect(isWatchable({ market: "PRIVATE" })).toBe(false)
  })

  it("allows listed assets in either shape", () => {
    expect(isWatchable(makeAsset())).toBe(true)
    expect(isWatchable({ market: "NASDAQ" })).toBe(true)
  })
})

describe("toAssetCategoryId", () => {
  it("upper-cases provider casing", () => {
    expect(toAssetCategoryId("Mutual Fund")).toBe("MUTUAL FUND")
  })

  it("defaults to EQUITY", () => {
    expect(toAssetCategoryId(undefined)).toBe("EQUITY")
    expect(toAssetCategoryId("")).toBe("EQUITY")
  })
})
