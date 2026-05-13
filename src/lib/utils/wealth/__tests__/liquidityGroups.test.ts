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

  it("excludes portfolio dominated by Property", () => {
    expect(
      isLiquidPortfolio(
        makePortfolio("HOUSE", { Property: 500000, Cash: 1000 }),
      ),
    ).toBe(false)
  })

  it("excludes portfolio under raw 'RE' category name", () => {
    expect(isLiquidPortfolio(makePortfolio("HOUSE", { RE: 500000 }))).toBe(
      false,
    )
  })

  it("excludes portfolio under 'Real Estate' category name", () => {
    expect(
      isLiquidPortfolio(makePortfolio("HOUSE", { "Real Estate": 500000 })),
    ).toBe(false)
  })

  it("keeps portfolio when Cash dominates over Property", () => {
    expect(
      isLiquidPortfolio(makePortfolio("MIX", { Cash: 5000, Property: 4000 })),
    ).toBe(true)
  })

  it("keeps Equity-dominated portfolio", () => {
    expect(
      isLiquidPortfolio(makePortfolio("EQT", { Equity: 100000, Cash: 5000 })),
    ).toBe(true)
  })

  it("keeps Retirement-dominated portfolio (liquid for performance purposes)", () => {
    expect(
      isLiquidPortfolio(
        makePortfolio("PEN", { "Retirement Fund": 80000, Cash: 1000 }),
      ),
    ).toBe(true)
  })
})
