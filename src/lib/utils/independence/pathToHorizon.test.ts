import type { PathToHorizon } from "types/independence"
import { formatHorizonHeader, formatHorizonGap } from "./pathToHorizon"

/** Minimal PathToHorizon fixture; override per case. */
function mkHorizon(overrides: Partial<PathToHorizon> = {}): PathToHorizon {
  return {
    targetAge: 90,
    currentMonthlyContribution: 1000,
    requiredMonthlyContribution: 1800,
    currentReturnRate: 0.015,
    requiredReturnRate: 0.0432,
    ...overrides,
  }
}

describe("formatHorizonHeader", () => {
  it("offers both levers when both are solvable", () => {
    const result = formatHorizonHeader(mkHorizon(), "NZD")
    expect(result.tone).toBe("warning")
    // mentions the target age
    expect(result.text).toContain("90")
    // both the contribution lever and the return-rate lever
    expect(result.text).toContain("NZD1,800")
    expect(result.text).toContain("4.3%")
    // and what they're doing today
    expect(result.text).toContain("NZD1,000")
    expect(result.text).toContain("1.5%")
  })

  it("offers only the contribution lever when return rate is unsolvable", () => {
    const result = formatHorizonHeader(
      mkHorizon({ requiredReturnRate: null }),
      "NZD",
    )
    expect(result.tone).toBe("warning")
    expect(result.text).toContain("NZD1,800")
    // no return-rate target shown
    expect(result.text).not.toContain("4.3%")
  })

  it("offers only the return-rate lever when contribution is unsolvable", () => {
    const result = formatHorizonHeader(
      mkHorizon({ requiredMonthlyContribution: null }),
      "NZD",
    )
    expect(result.tone).toBe("warning")
    expect(result.text).toContain("4.3%")
    // no required contribution target shown
    expect(result.text).not.toContain("NZD1,800")
  })

  it("falls back to a no-numbers message when both levers are unsolvable", () => {
    const result = formatHorizonHeader(
      mkHorizon({
        requiredMonthlyContribution: null,
        requiredReturnRate: null,
      }),
      "NZD",
    )
    expect(result.tone).toBe("warning")
    expect(result.text).toContain("90")
    // no solver numbers leak into the fallback copy
    expect(result.text).not.toContain("NZD1,800")
    expect(result.text).not.toContain("4.3%")
  })
})

describe("formatHorizonGap", () => {
  it("computes the contribution gap (required - current)", () => {
    const result = formatHorizonGap(mkHorizon(), "NZD")
    // 1800 - 1000 = 800
    expect(result).toContain("NZD800")
    expect(result).toContain("90")
  })

  it("returns null when required contribution is unsolvable", () => {
    expect(
      formatHorizonGap(mkHorizon({ requiredMonthlyContribution: null }), "NZD"),
    ).toBeNull()
  })

  it("returns null when there is no positive gap (already contributing enough)", () => {
    expect(
      formatHorizonGap(
        mkHorizon({
          currentMonthlyContribution: 2000,
          requiredMonthlyContribution: 1800,
        }),
        "NZD",
      ),
    ).toBeNull()
  })
})
