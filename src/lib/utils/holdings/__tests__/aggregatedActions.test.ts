import {
  buildAggregateWeightByAssetId,
  indexBreakdownByAssetId,
  portfolioWeights,
  portfolioIdsForCodes,
  resolveTarget,
  tradeSeedForRow,
} from "../aggregatedActions"
import {
  makePortfolio,
  makePortfolioBreakdown,
} from "@test-fixtures/beancounter"
import { QuickSellData } from "types/beancounter"

describe("indexBreakdownByAssetId", () => {
  it("maps each position's asset id to its portfolio breakdown", () => {
    const aBreakdown = [makePortfolioBreakdown({ portfolioId: "p1" })]
    const bBreakdown = [
      makePortfolioBreakdown({ portfolioId: "p1" }),
      makePortfolioBreakdown({ portfolioId: "p2" }),
    ]
    const holdingGroups = {
      Equity: {
        positions: [
          { asset: { id: "asset-a" }, portfolioBreakdown: aBreakdown },
          { asset: { id: "asset-b" }, portfolioBreakdown: bBreakdown },
        ],
      },
    }

    const index = indexBreakdownByAssetId(holdingGroups)

    expect(index.get("asset-a")).toBe(aBreakdown)
    expect(index.get("asset-b")).toBe(bBreakdown)
  })

  it("skips positions without a breakdown", () => {
    const holdingGroups = {
      Equity: { positions: [{ asset: { id: "asset-a" } }] },
    }
    expect(indexBreakdownByAssetId(holdingGroups).has("asset-a")).toBe(false)
  })
})

describe("buildAggregateWeightByAssetId", () => {
  it("maps asset id to its aggregate weight as a percentage", () => {
    const holdingGroups = {
      Equity: {
        positions: [
          {
            asset: { id: "asset-a" },
            moneyValues: { PORTFOLIO: { weight: 0.0011 } },
          },
          {
            asset: { id: "asset-b" },
            moneyValues: { PORTFOLIO: { weight: 0.25 } },
          },
        ],
      },
    }

    const index = buildAggregateWeightByAssetId(holdingGroups, "PORTFOLIO")

    expect(index.get("asset-a")).toBeCloseTo(0.11)
    expect(index.get("asset-b")).toBeCloseTo(25)
  })

  it("reads the weight for the requested valueIn", () => {
    const holdingGroups = {
      Equity: {
        positions: [
          {
            asset: { id: "asset-a" },
            moneyValues: { PORTFOLIO: { weight: 0.1 }, BASE: { weight: 0.2 } },
          },
        ],
      },
    }
    expect(
      buildAggregateWeightByAssetId(holdingGroups, "BASE").get("asset-a"),
    ).toBeCloseTo(20)
  })

  it("skips positions with no weight for the valueIn", () => {
    const holdingGroups = {
      Equity: { positions: [{ asset: { id: "asset-a" }, moneyValues: {} }] },
    }
    expect(
      buildAggregateWeightByAssetId(holdingGroups, "PORTFOLIO").has("asset-a"),
    ).toBe(false)
  })
})

describe("resolveTarget", () => {
  it("returns direct with the single portfolio when held in one", () => {
    const only = makePortfolioBreakdown({ portfolioId: "p1" })
    expect(resolveTarget([only])).toEqual({ kind: "direct", target: only })
  })

  it("returns choose with all options when held in multiple", () => {
    const options = [
      makePortfolioBreakdown({ portfolioId: "p1" }),
      makePortfolioBreakdown({ portfolioId: "p2" }),
    ]
    expect(resolveTarget(options)).toEqual({ kind: "choose", options })
  })

  it("returns none when there is no breakdown", () => {
    expect(resolveTarget(undefined)).toEqual({ kind: "none" })
    expect(resolveTarget([])).toEqual({ kind: "none" })
  })
})

describe("tradeSeedForRow", () => {
  const data: QuickSellData = {
    asset: "SCHD",
    assetId: "asset-a",
    market: "US",
    quantity: 255, // aggregate total across portfolios
    price: 25,
    held: { DBS: 200, SCB: 80 }, // aggregate-wide broker map
  }

  it("seeds a SELL from the chosen portfolio's quantity and broker map", () => {
    const row = makePortfolioBreakdown({
      portfolioId: "p1",
      quantity: 255,
      held: { DBS: 175, SCB: 80 },
    })
    const seed = tradeSeedForRow(data, row, "SELL")
    expect(seed.type).toBe("SELL")
    expect(seed.quantity).toBe(255)
    expect(seed.held).toEqual({ DBS: 175, SCB: 80 })
  })

  it("keeps the aggregate quantity for non-SELL types but scopes held to the row", () => {
    const row = makePortfolioBreakdown({
      portfolioId: "p1",
      quantity: 100,
      held: { DBS: 100 },
    })
    const seed = tradeSeedForRow(data, row, "BUY")
    expect(seed.type).toBe("BUY")
    expect(seed.quantity).toBe(255)
    expect(seed.held).toEqual({ DBS: 100 })
  })

  it("falls back to the aggregate held map when the row has none", () => {
    const row = makePortfolioBreakdown({ portfolioId: "p1", quantity: 255 })
    const seed = tradeSeedForRow(data, row, "SELL")
    expect(seed.held).toEqual({ DBS: 200, SCB: 80 })
  })
})

describe("portfolioIdsForCodes", () => {
  const portfolios = [
    makePortfolio({ id: "pf-a", code: "A" }),
    makePortfolio({ id: "pf-b", code: "B" }),
  ]

  it("maps codes to ids in the order requested", () => {
    expect(portfolioIdsForCodes(["B", "A"], portfolios)).toEqual([
      "pf-b",
      "pf-a",
    ])
  })

  it("names each portfolio once when a code repeats", () => {
    expect(portfolioIdsForCodes(["A", "A"], portfolios)).toEqual(["pf-a"])
  })

  it("drops codes the user does not hold", () => {
    expect(portfolioIdsForCodes(["A", "MISSING"], portfolios)).toEqual(["pf-a"])
  })
})

describe("portfolioWeights", () => {
  const held = (
    marketValue: number,
    total: number,
    holders: [string, number][],
  ): Parameters<typeof portfolioWeights>[0][string] => ({
    moneyValues: { PORTFOLIO: { marketValue } },
    quantityValues: { total },
    portfolioBreakdown: holders.map(([code, quantity]) =>
      makePortfolioBreakdown({
        portfolioId: `pf-${code}`,
        portfolioCode: code,
        portfolioName: `${code} name`,
        quantity,
      }),
    ),
  })

  it("splits each position by quantity and ranks by weight", () => {
    const weights = portfolioWeights({
      shared: held(600, 30, [
        ["A", 10],
        ["B", 20],
      ]),
      solo: held(400, 5, [["B", 5]]),
    })

    expect(weights.map((w) => [w.portfolioCode, w.weight])).toEqual([
      ["B", 80],
      ["A", 20],
    ])
  })

  it("keeps a selected portfolio that holds nothing, at zero", () => {
    const weights = portfolioWeights({ solo: held(100, 1, [["A", 1]]) }, [
      makePortfolio({ id: "pf-Z", code: "Z", name: "Z name" }),
    ])

    expect(weights.at(-1)).toEqual({
      portfolioId: "pf-Z",
      portfolioCode: "Z",
      portfolioName: "Z name",
      weight: 0,
    })
  })

  it("reports zero rather than dividing by an empty view", () => {
    expect(portfolioWeights({ flat: held(0, 1, [["A", 1]]) })[0].weight).toBe(0)
  })

  it("keeps shares signed when the view nets negative", () => {
    const weights = portfolioWeights({
      asset: held(100, 1, [["A", 1]]),
      overdraft: held(-300, 1, [["B", 1]]),
    })

    expect(weights.map((w) => [w.portfolioCode, w.weight])).toEqual([
      ["A", 50],
      ["B", -150],
    ])
  })

  it("orders ties by code so the list is stable", () => {
    const weights = portfolioWeights({
      shared: held(100, 2, [
        ["B", 1],
        ["A", 1],
      ]),
    })

    expect(weights.map((w) => w.portfolioCode)).toEqual(["A", "B"])
  })

  it("ignores positions with no quantity to split", () => {
    expect(portfolioWeights({ sold: held(50, 0, [["A", 1]]) })).toHaveLength(0)
  })
})
