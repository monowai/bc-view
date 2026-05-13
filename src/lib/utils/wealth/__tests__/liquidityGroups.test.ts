import { isLiquidPortfolio } from "@lib/wealth/liquidityGroups"
import { Portfolio } from "types/beancounter"

function makePortfolio(
  code: string,
  classification: Record<string, number> | undefined,
): Portfolio {
  return {
    id: code,
    code,
    name: code,
    currency: { code: "USD", name: "USD", symbol: "$" },
    base: { code: "USD", name: "USD", symbol: "$" },
    marketValue: Object.values(classification ?? {}).reduce((s, v) => s + v, 0),
    irr: 0,
    assetClassification: classification,
  }
}

describe("isLiquidPortfolio", () => {
  it("treats portfolio with no assetClassification as liquid", () => {
    expect(isLiquidPortfolio(makePortfolio("P1", undefined))).toBe(true)
  })

  it("treats portfolio with empty assetClassification as liquid", () => {
    expect(isLiquidPortfolio(makePortfolio("P1", {}))).toBe(true)
  })

  it("excludes portfolio with any Property exposure", () => {
    expect(
      isLiquidPortfolio(
        makePortfolio("HOUSE", { Property: 500000, Cash: 1000 }),
      ),
    ).toBe(false)
  })

  it("excludes portfolio under raw 'RE' category id", () => {
    expect(isLiquidPortfolio(makePortfolio("HOUSE", { RE: 500000 }))).toBe(
      false,
    )
  })

  it("excludes portfolio under 'Real Estate' raw name", () => {
    expect(
      isLiquidPortfolio(makePortfolio("HOUSE", { "Real Estate": 500000 })),
    ).toBe(false)
  })

  it("excludes commingled portfolio even when Cash dominates", () => {
    // Any PRIVATE+RE exposure pollutes aggregate TWR signal.
    expect(
      isLiquidPortfolio(makePortfolio("MIX", { Cash: 5000, Property: 4000 })),
    ).toBe(false)
  })

  it("keeps RE-ETF holdings — they classify as ETF, not Property", () => {
    expect(
      isLiquidPortfolio(
        makePortfolio("REIT", {
          "Exchange Traded Fund": 100000,
          Cash: 5000,
        }),
      ),
    ).toBe(true)
  })

  it("keeps Equity-only portfolio", () => {
    expect(
      isLiquidPortfolio(makePortfolio("EQT", { Equity: 100000, Cash: 5000 })),
    ).toBe(true)
  })

  it("keeps Retirement-fund portfolio", () => {
    expect(
      isLiquidPortfolio(
        makePortfolio("PEN", { "Retirement Fund": 80000, Cash: 1000 }),
      ),
    ).toBe(true)
  })

  it("keeps portfolio when Property entry is present but zero", () => {
    expect(
      isLiquidPortfolio(makePortfolio("EDGE", { Property: 0, Equity: 100000 })),
    ).toBe(true)
  })
})
