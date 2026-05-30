import { isLiquidPortfolio } from "@lib/wealth/liquidityGroups"
import { makePortfolio } from "@test-fixtures/beancounter"

describe("isLiquidPortfolio", () => {
  it("treats portfolio with no assetClassification as liquid", () => {
    expect(isLiquidPortfolio(makePortfolio())).toBe(true)
  })

  it("treats portfolio with empty assetClassification as liquid", () => {
    expect(isLiquidPortfolio(makePortfolio({ assetClassification: {} }))).toBe(
      true,
    )
  })

  it("excludes portfolio with any Property exposure", () => {
    expect(
      isLiquidPortfolio(
        makePortfolio({
          code: "HOUSE",
          assetClassification: { Property: 500000, Cash: 1000 },
        }),
      ),
    ).toBe(false)
  })

  it("excludes portfolio under raw 'RE' category id", () => {
    expect(
      isLiquidPortfolio(
        makePortfolio({
          code: "HOUSE",
          assetClassification: { RE: 500000 },
        }),
      ),
    ).toBe(false)
  })

  it("excludes portfolio under 'Real Estate' raw name", () => {
    expect(
      isLiquidPortfolio(
        makePortfolio({
          code: "HOUSE",
          assetClassification: { "Real Estate": 500000 },
        }),
      ),
    ).toBe(false)
  })

  it("excludes commingled portfolio even when Cash dominates", () => {
    // Any PRIVATE+RE exposure pollutes aggregate TWR signal.
    expect(
      isLiquidPortfolio(
        makePortfolio({
          code: "MIX",
          assetClassification: { Cash: 5000, Property: 4000 },
        }),
      ),
    ).toBe(false)
  })

  it("keeps RE-ETF holdings — they classify as ETF, not Property", () => {
    expect(
      isLiquidPortfolio(
        makePortfolio({
          code: "REIT",
          assetClassification: {
            "Exchange Traded Fund": 100000,
            Cash: 5000,
          },
        }),
      ),
    ).toBe(true)
  })

  it("keeps Equity-only portfolio", () => {
    expect(
      isLiquidPortfolio(
        makePortfolio({
          code: "EQT",
          assetClassification: { Equity: 100000, Cash: 5000 },
        }),
      ),
    ).toBe(true)
  })

  it("keeps Retirement-fund portfolio", () => {
    expect(
      isLiquidPortfolio(
        makePortfolio({
          code: "PEN",
          assetClassification: { Policies: 80000, Cash: 1000 },
        }),
      ),
    ).toBe(true)
  })

  it("keeps portfolio when Property entry is present but zero", () => {
    expect(
      isLiquidPortfolio(
        makePortfolio({
          code: "EDGE",
          assetClassification: { Property: 0, Equity: 100000 },
        }),
      ),
    ).toBe(true)
  })
})
