import {
  stripOwnerPrefix,
  getDisplayCode,
  isNonTradeable,
  isFundLike,
  getPositionDisplayName,
  buildTradesHref,
  buildAggregatedTradesHref,
  buildNewsAsset,
} from "../assetUtils"
import { makeAsset, makeCashAsset } from "@test-fixtures/beancounter"

describe("isFundLike", () => {
  it("is true for ETF", () => {
    expect(
      isFundLike(makeAsset({ assetCategory: { id: "ETF", name: "ETF" } })),
    ).toBe(true)
  })

  it("is true for MUTUAL FUND (e.g. LSE/LON-listed UCITS funds)", () => {
    expect(
      isFundLike(
        makeAsset({
          assetCategory: { id: "MUTUAL FUND", name: "Mutual Fund" },
        }),
      ),
    ).toBe(true)
  })

  it("is false for a plain equity", () => {
    expect(
      isFundLike(
        makeAsset({ assetCategory: { id: "EQUITY", name: "Equity" } }),
      ),
    ).toBe(false)
  })

  // The call sites this helper replaced used `assetCategory?.id`, so positions
  // arriving without a category must not throw.
  it("is false, not throwing, when the asset carries no category", () => {
    const asset = makeAsset({})
    // @ts-expect-error - the type says required, runtime data disagrees
    delete asset.assetCategory

    expect(() => isFundLike(asset)).not.toThrow()
    expect(isFundLike(asset)).toBe(false)
  })
})

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
  it("reads the display code the server sends", () => {
    const asset = makeAsset({
      code: "148_OBRVTziEJUdnLKsSlA.SCB-SGD",
      displayCode: "SCB-SGD",
    })
    expect(getDisplayCode(asset)).toBe("SCB-SGD")
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

  it("returns the server's display code for non-cash assets", () => {
    expect(
      getPositionDisplayName(
        makeAsset({ code: "148_OBRVTziEJUdnLKsSlA.AAPL", displayCode: "AAPL" }),
      ),
    ).toBe("AAPL")
  })
})

describe("buildTradesHref", () => {
  it("returns canonical trades route", () => {
    expect(buildTradesHref("p-1", "asset-aapl")).toBe(
      "/trns/trades/p-1/asset-aapl",
    )
  })
})

describe("buildAggregatedTradesHref", () => {
  it("routes by asset with portfolios as a query param", () => {
    expect(buildAggregatedTradesHref("asset-aapl", ["p-1", "p-2"])).toBe(
      "/trns/trades/asset-aapl?portfolios=p-1,p-2",
    )
  })
})

describe("buildNewsAsset", () => {
  it("takes the server's display code as ticker, market.code, defaults assetName to empty", () => {
    const asset = makeAsset({
      code: "148_OBRVTziEJUdnLKsSlA.AAPL",
      displayCode: "AAPL",
      name: "",
    })
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
