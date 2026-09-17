import { DEFAULT_NON_SPENDABLE, TABS, getCategoryReturnType } from "../types"

describe("types constants", () => {
  describe("DEFAULT_NON_SPENDABLE", () => {
    it("contains Property category", () => {
      expect(DEFAULT_NON_SPENDABLE).toContain("Property")
    })
  })

  describe("TABS", () => {
    it("offers two reading sections and one place to change things", () => {
      expect(TABS.map((t) => t.id)).toEqual(["standing", "path", "setup"])
    })

    it("names sections in plain language, not FIRE jargon", () => {
      // The reader is someone learning to manage a plan, not an adviser.
      // "FI Overview" and "Metrics" told them nothing about what they'd find.
      expect(TABS.map((t) => t.label)).toEqual([
        "Where you stand",
        "Your path",
        "Set up",
      ])
    })

    it("does not reuse a label that means something else on the plan page", () => {
      // "Summary", "FI Overview" and "Stress Test" each named a tab here AND
      // a different tab one level up on the composite plan. Same word, two
      // meanings, one click apart.
      const collisions = ["Summary", "FI Overview", "Stress Test", "Phases"]
      for (const label of TABS.map((t) => t.label)) {
        expect(collisions).not.toContain(label)
      }
    })

    it("gives every section a byline saying what it answers", () => {
      for (const tab of TABS) {
        expect(tab.byline).toBeDefined()
        expect(tab.byline.length).toBeGreaterThan(0)
      }
    })

    it("has an icon for each section", () => {
      for (const tab of TABS) {
        expect(tab.icon).toMatch(/^fa-/)
      }
    })
  })
})

describe("getCategoryReturnType", () => {
  it("returns equity for Equity category", () => {
    expect(getCategoryReturnType("Equity")).toBe("equity")
  })

  it("returns equity for ETF category", () => {
    expect(getCategoryReturnType("ETF")).toBe("equity")
  })

  it("returns equity for Mutual Fund category", () => {
    expect(getCategoryReturnType("Mutual Fund")).toBe("equity")
  })

  it("returns cash for Cash category", () => {
    expect(getCategoryReturnType("Cash")).toBe("cash")
  })

  it("returns housing for Property category", () => {
    expect(getCategoryReturnType("Property")).toBe("housing")
  })

  it("returns equity for unknown category (default)", () => {
    expect(getCategoryReturnType("Unknown Category")).toBe("equity")
  })

  it("is case insensitive", () => {
    expect(getCategoryReturnType("CASH")).toBe("cash")
    expect(getCategoryReturnType("cash")).toBe("cash")
    expect(getCategoryReturnType("PROPERTY")).toBe("housing")
    expect(getCategoryReturnType("property")).toBe("housing")
  })
})
