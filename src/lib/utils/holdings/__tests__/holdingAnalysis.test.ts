import {
  canAnalyseHolding,
  holdingAnalysisPortfolioCode,
} from "../holdingAnalysis"
import {
  makeAsset,
  makeCashAsset,
  makePortfolioBreakdown,
} from "@test-fixtures/beancounter"

describe("canAnalyseHolding", () => {
  it("allows a held asset the server can review", () => {
    expect(canAnalyseHolding(makeAsset(), 10)).toBe(true)
  })

  it("refuses an asset with nothing held", () => {
    expect(canAnalyseHolding(makeAsset(), 0)).toBe(false)
  })

  it("refuses an asset with no news to review", () => {
    expect(canAnalyseHolding(makeAsset({ hasNews: false }), 10)).toBe(false)
  })

  it("refuses an unchartable asset", () => {
    expect(canAnalyseHolding(makeAsset({ chartable: false }), 10)).toBe(false)
  })

  it("refuses cash", () => {
    expect(canAnalyseHolding(makeCashAsset(), 10)).toBe(false)
  })
})

describe("holdingAnalysisPortfolioCode", () => {
  it("uses the page's portfolio when the row has no breakdown", () => {
    expect(holdingAnalysisPortfolioCode("ABC", undefined)).toBe("ABC")
    expect(holdingAnalysisPortfolioCode("ABC", [])).toBe("ABC")
  })

  it("uses the one portfolio an aggregated row belongs to", () => {
    expect(
      holdingAnalysisPortfolioCode("AGG", [
        makePortfolioBreakdown({ portfolioCode: "ONLY" }),
      ]),
    ).toBe("ONLY")
  })

  it("offers nothing when an aggregated row spans several portfolios", () => {
    expect(
      holdingAnalysisPortfolioCode("AGG", [
        makePortfolioBreakdown({ portfolioCode: "ONE" }),
        makePortfolioBreakdown({ portfolioCode: "TWO" }),
      ]),
    ).toBeUndefined()
  })
})
