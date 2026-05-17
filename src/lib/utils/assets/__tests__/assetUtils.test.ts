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
  const USER_ID = "148_OBRVTziEJUdnLKsSlA" // realistic 22-char base64 userId

  it("strips a real userId prefix", () => {
    expect(stripOwnerPrefix(`${USER_ID}.WISE`)).toBe("WISE")
  })

  it("returns full code when no dot present", () => {
    expect(stripOwnerPrefix("AAPL")).toBe("AAPL")
  })

  it("returns empty string for empty input", () => {
    expect(stripOwnerPrefix("")).toBe("")
  })

  it("preserves public dotted tickers (BRK.B regression)", () => {
    // Berkshire Hathaway Class B — must not collapse to "B".
    expect(stripOwnerPrefix("BRK.B")).toBe("BRK.B")
    expect(stripOwnerPrefix("RDS.A")).toBe("RDS.A")
  })

  it("preserves tickers even when multiple dots are present", () => {
    // Short prefix segments mean none is long enough to be an owner id.
    expect(stripOwnerPrefix("a.b.c")).toBe("a.b.c")
  })

  it("strips when prefix is long enough to plausibly be an owner id", () => {
    expect(stripOwnerPrefix(`${USER_ID}.BRK.B`)).toBe("BRK.B")
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
  const USER_ID = "148_OBRVTziEJUdnLKsSlA"

  it("returns stripped code for asset with owner prefix", () => {
    const asset = { code: `${USER_ID}.SCB-SGD` } as any
    expect(getDisplayCode(asset)).toBe("SCB-SGD")
  })

  it("returns code as-is for asset without dot", () => {
    const asset = { code: "AAPL" } as any
    expect(getDisplayCode(asset)).toBe("AAPL")
  })

  it("preserves dotted public tickers (BRK.B regression)", () => {
    const asset = { code: "BRK.B" } as any
    expect(getDisplayCode(asset)).toBe("BRK.B")
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
    expect(
      getPositionDisplayName(
        makeAsset({ code: "148_OBRVTziEJUdnLKsSlA.AAPL" }),
      ),
    ).toBe("AAPL")
  })

  it("returns code unchanged when no owner prefix", () => {
    expect(getPositionDisplayName(makeAsset({ code: "MSFT" }))).toBe("MSFT")
  })

  it("preserves dotted public tickers", () => {
    expect(getPositionDisplayName(makeAsset({ code: "BRK.B" }))).toBe("BRK.B")
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
    const asset = makeAsset({ code: "148_OBRVTziEJUdnLKsSlA.AAPL", name: "" })
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

  it("preserves dotted public tickers (BRK.B regression)", () => {
    const asset = makeAsset({ code: "BRK.B", name: "Berkshire Hathaway B" })
    expect(buildNewsAsset(asset)).toEqual({
      ticker: "BRK.B",
      market: "NASDAQ",
      assetName: "Berkshire Hathaway B",
    })
  })
})
