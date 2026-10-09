import { EMPTY_WEALTH_SUMMARY, toWealthSummary } from "../wealthSummary"
import { makeNetWorth } from "@test-fixtures/beancounter"

const NO_SORT = { key: null as string | null, direction: "asc" as const }

function codes(
  sortConfig: { key: string | null; direction: "asc" | "desc" },
  netWorth = makeNetWorth(),
): string[] {
  return toWealthSummary(netWorth, sortConfig).portfolioBreakdown.map(
    (p) => p.code,
  )
}

describe("toWealthSummary", () => {
  it("carries the server-computed headline through unchanged", () => {
    const summary = toWealthSummary(
      makeNetWorth({
        totalValue: 123456,
        gainOnDay: 789,
        healthcareReserve: 4321,
        portfolioCount: 3,
      }),
      NO_SORT,
    )
    expect(summary.totalValue).toBe(123456)
    expect(summary.totalGainOnDay).toBe(789)
    expect(summary.healthcareReserve).toBe(4321)
    expect(summary.portfolioCount).toBe(3)
  })

  it("passes the classification breakdown through as-is", () => {
    const netWorth = makeNetWorth()
    const summary = toWealthSummary(netWorth, NO_SORT)
    expect(summary.classificationBreakdown).toEqual(
      netWorth.classificationBreakdown,
    )
  })

  it("maps portfolios onto the breakdown rows", () => {
    const summary = toWealthSummary(makeNetWorth(), NO_SORT)
    expect(summary.portfolioBreakdown).toEqual([
      {
        code: "ALPHA",
        name: "Alpha Portfolio",
        value: 100000,
        percentage: 66.67,
        irr: 0.05,
      },
      {
        code: "BETA",
        name: "Beta Portfolio",
        value: 50000,
        percentage: 33.33,
        irr: 0.03,
      },
    ])
  })

  describe("sorting", () => {
    const netWorth = makeNetWorth({
      portfolios: [
        {
          id: "1",
          code: "mid",
          name: "Mid",
          value: 200,
          percentage: 20,
          irr: 0.3,
        },
        {
          id: "2",
          code: "Alpha",
          name: "Alpha",
          value: 500,
          percentage: 50,
          irr: 0.1,
        },
        {
          id: "3",
          code: "zed",
          name: "Zed",
          value: 300,
          percentage: 30,
          irr: 0.2,
        },
      ],
    })

    it("leaves the server order alone without a sort key", () => {
      expect(codes(NO_SORT, netWorth)).toEqual(["mid", "Alpha", "zed"])
    })

    it("sorts by code case-insensitively, ascending", () => {
      expect(codes({ key: "code", direction: "asc" }, netWorth)).toEqual([
        "Alpha",
        "mid",
        "zed",
      ])
    })

    it("sorts by code descending", () => {
      expect(codes({ key: "code", direction: "desc" }, netWorth)).toEqual([
        "zed",
        "mid",
        "Alpha",
      ])
    })

    it("sorts by value descending", () => {
      expect(codes({ key: "value", direction: "desc" }, netWorth)).toEqual([
        "Alpha",
        "zed",
        "mid",
      ])
    })

    it("sorts by percentage ascending", () => {
      expect(codes({ key: "percentage", direction: "asc" }, netWorth)).toEqual([
        "mid",
        "zed",
        "Alpha",
      ])
    })

    it("sorts by irr descending", () => {
      expect(codes({ key: "irr", direction: "desc" }, netWorth)).toEqual([
        "mid",
        "zed",
        "Alpha",
      ])
    })

    it("ignores an unknown sort key", () => {
      expect(codes({ key: "nope", direction: "asc" }, netWorth)).toEqual([
        "mid",
        "Alpha",
        "zed",
      ])
    })

    it("does not mutate its input when sorting", () => {
      const before = netWorth.portfolios.map((p) => p.code)
      toWealthSummary(netWorth, { key: "code", direction: "desc" })
      expect(netWorth.portfolios.map((p) => p.code)).toEqual(before)
    })
  })
})

describe("EMPTY_WEALTH_SUMMARY", () => {
  it("is frozen, arrays included, so no consumer can mutate the shared empty pot", () => {
    expect(Object.isFrozen(EMPTY_WEALTH_SUMMARY)).toBe(true)
    expect(Object.isFrozen(EMPTY_WEALTH_SUMMARY.portfolioBreakdown)).toBe(true)
    expect(Object.isFrozen(EMPTY_WEALTH_SUMMARY.classificationBreakdown)).toBe(
      true,
    )
  })
})
