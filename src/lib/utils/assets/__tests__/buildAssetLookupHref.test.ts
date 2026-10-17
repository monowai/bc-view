import { buildAssetLookupHref } from "@lib/assets/assetUtils"
import { makeAsset } from "@test-fixtures/beancounter"

describe("buildAssetLookupHref", () => {
  it("carries currency and type so the lookup page hydrates the category", () => {
    const href = buildAssetLookupHref(
      makeAsset({
        id: "a-1",
        code: "VWRA",
        name: "World ETF",
        assetCategory: { id: "ETF", name: "ETF" },
      }),
    )
    const query = new URLSearchParams(href.split("?")[1])

    expect(href.startsWith("/assets/lookup?")).toBe(true)
    expect(query.get("assetId")).toBe("a-1")
    expect(query.get("symbol")).toBe("VWRA")
    expect(query.get("market")).toBe("NASDAQ")
    expect(query.get("currency")).toBe("USD")
    expect(query.get("type")).toBe("ETF")
  })
})
