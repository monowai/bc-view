import {
  stripOwnerPrefix,
  getDisplayCode,
  isCashRelated,
  isNonTradeable,
  getPositionDisplayName,
  buildTradesHref,
  buildNewsAsset,
} from "../assetUtils"
import { makeAsset, makeCashAsset } from "@test-fixtures/beancounter"

describe("stripOwnerPrefix", () => {
  it("returns code after last dot", () => {
    expect(stripOwnerPrefix("userId.WISE")).toBe("WISE")
  })

  it("returns full code when no dot present", () => {
    expect(stripOwnerPrefix("AAPL")).toBe("AAPL")
  })

  it("returns empty string for empty input", () => {
    expect(stripOwnerPrefix("")).toBe("")
  })

  it("handles code with multiple dots (returns after last dot)", () => {
    expect(stripOwnerPrefix("a.b.c")).toBe("c")
  })

  it("handles dot at start", () => {
    expect(stripOwnerPrefix(".WISE")).toBe("WISE")
  })

  it("handles dot at end", () => {
    expect(stripOwnerPrefix("userId.")).toBe("")
  })
})

describe("isCashRelated", () => {
  it("returns true for CASH", () => {
    expect(isCashRelated({ assetCategory: { id: "CASH" } } as any)).toBe(true)
  })
  it("returns true for ACCOUNT", () => {
    expect(isCashRelated({ assetCategory: { id: "ACCOUNT" } } as any)).toBe(
      true,
    )
  })
  it("returns false for RE", () => {
    expect(isCashRelated({ assetCategory: { id: "RE" } } as any)).toBe(false)
  })
  it("returns false for EQUITY", () => {
    expect(isCashRelated({ assetCategory: { id: "EQUITY" } } as any)).toBe(
      false,
    )
  })
})

describe("isNonTradeable", () => {
  it("returns true for RE", () => {
    expect(isNonTradeable({ assetCategory: { id: "RE" } } as any)).toBe(true)
  })
  it("returns true for CASH", () => {
    expect(isNonTradeable({ assetCategory: { id: "CASH" } } as any)).toBe(true)
  })
  it("returns true for ACCOUNT", () => {
    expect(isNonTradeable({ assetCategory: { id: "ACCOUNT" } } as any)).toBe(
      true,
    )
  })
  it("returns false for EQUITY", () => {
    expect(isNonTradeable({ assetCategory: { id: "EQUITY" } } as any)).toBe(
      false,
    )
  })
})

describe("getDisplayCode", () => {
  it("returns stripped code for asset with owner prefix", () => {
    const asset = { code: "userId.SCB-SGD" } as any
    expect(getDisplayCode(asset)).toBe("SCB-SGD")
  })

  it("returns code as-is for asset without dot", () => {
    const asset = { code: "AAPL" } as any
    expect(getDisplayCode(asset)).toBe("AAPL")
  })

  it("returns empty string for null asset", () => {
    expect(getDisplayCode(null)).toBe("")
  })

  it("returns empty string for undefined asset", () => {
    expect(getDisplayCode(undefined)).toBe("")
  })
})

describe("getPositionDisplayName", () => {
  it("returns asset.name for cash assets", () => {
    const cash = makeCashAsset()
    cash.name = "USD Cash"
    expect(getPositionDisplayName(cash)).toBe("USD Cash")
  })

  it("returns stripped code for non-cash assets", () => {
    expect(getPositionDisplayName(makeAsset({ code: "userId.AAPL" }))).toBe(
      "AAPL",
    )
  })

  it("returns code unchanged when no owner prefix", () => {
    expect(getPositionDisplayName(makeAsset({ code: "MSFT" }))).toBe("MSFT")
  })
})

describe("buildTradesHref", () => {
  it("returns canonical trades route", () => {
    expect(buildTradesHref("p-1", "asset-aapl")).toBe(
      "/trns/trades/p-1/asset-aapl",
    )
  })
})

describe("buildNewsAsset", () => {
  it("strips owner prefix from ticker, takes market.code, defaults assetName to empty", () => {
    const asset = makeAsset({ code: "userId.AAPL", name: "" })
    expect(buildNewsAsset(asset)).toEqual({
      ticker: "AAPL",
      market: "NASDAQ",
      assetName: "",
    })
  })

  it("preserves asset.name when present", () => {
    const asset = makeAsset({ code: "AAPL", name: "Apple Inc." })
    expect(buildNewsAsset(asset)).toEqual({
      ticker: "AAPL",
      market: "NASDAQ",
      assetName: "Apple Inc.",
    })
  })
})
