import { DEFAULT_NON_SPENDABLE, TABS, getCategoryReturnType } from "../types"

describe("types constants", () => {
  describe("DEFAULT_NON_SPENDABLE", () => {
    it("contains Property category", () => {
      expect(DEFAULT_NON_SPENDABLE).toContain("Property")
    })
  })

  describe("TABS", () => {
    it("has all expected tabs", () => {
      expect(TABS).toHaveLength(6)
      expect(TABS.map((t) => t.id)).toEqual([
        "details",
        "breakdown",
        "fi",
        "assets",
        "timeline",
        "simulation",
      ])
    })

    it("has correct labels", () => {
      expect(TABS.find((t) => t.id === "fi")?.label).toBe("FI Overview")
      expect(TABS.find((t) => t.id === "details")?.label).toBe("My Plan")
      expect(TABS.find((t) => t.id === "assets")?.label).toBe("Metrics")
      expect(TABS.find((t) => t.id === "breakdown")?.label).toBe("Assets")
      expect(TABS.find((t) => t.id === "timeline")?.label).toBe("My Path")
      expect(TABS.find((t) => t.id === "simulation")?.label).toBe("Stress Test")
    })

    it("has correct icons", () => {
      expect(TABS.find((t) => t.id === "fi")?.icon).toBe("fa-bullseye")
      expect(TABS.find((t) => t.id === "details")?.icon).toBe(
        "fa-clipboard-list",
      )
      expect(TABS.find((t) => t.id === "assets")?.icon).toBe("fa-wallet")
      expect(TABS.find((t) => t.id === "timeline")?.icon).toBe("fa-chart-line")
      expect(TABS.find((t) => t.id === "simulation")?.icon).toBe("fa-dice")
    })

    it("has bylines for each tab", () => {
      for (const tab of TABS) {
        expect(tab.byline).toBeDefined()
        expect(tab.byline.length).toBeGreaterThan(0)
      }
      expect(TABS.find((t) => t.id === "fi")?.byline).toContain("FI target")
      expect(TABS.find((t) => t.id === "details")?.byline).toContain(
        "inputs that drive everything",
      )
      expect(TABS.find((t) => t.id === "assets")?.byline).toContain(
        "independence",
      )
      expect(TABS.find((t) => t.id === "timeline")?.byline).toContain(
        "wealth grows",
      )
      expect(TABS.find((t) => t.id === "simulation")?.byline).toContain(
        "markets",
      )
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
