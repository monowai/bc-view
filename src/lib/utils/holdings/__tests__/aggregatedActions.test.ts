import { indexBreakdownByAssetId, resolveTarget } from "../aggregatedActions"
import { makePortfolioBreakdown } from "@test-fixtures/beancounter"

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
