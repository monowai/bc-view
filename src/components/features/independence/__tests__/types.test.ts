import {
  DEFAULT_WHAT_IF_ADJUSTMENTS,
  DEFAULT_NON_SPENDABLE,
  TABS,
  hasScenarioChanges,
  getCategoryReturnType,
  WhatIfAdjustments,
} from "../types"

describe("types constants", () => {
  describe("DEFAULT_WHAT_IF_ADJUSTMENTS", () => {
    it("has correct default values", () => {
      expect(DEFAULT_WHAT_IF_ADJUSTMENTS).toEqual({
        retirementAgeOffset: 0,
        expensesPercent: 100,
        returnRateOffset: 0,
        inflationOffset: 0,
        contributionPercent: 100,
        equityPercent: null,
        liquidationThreshold: 10,
      })
    })
  })

  describe("DEFAULT_NON_SPENDABLE", () => {
    it("contains Property category", () => {
      expect(DEFAULT_NON_SPENDABLE).toContain("Property")
    })
  })

  describe("TABS", () => {
    it("has all expected tabs", () => {
      expect(TABS).toHaveLength(5)
      expect(TABS.map((t) => t.id)).toEqual([
        "details",
        "assets",
        "fire",
        "timeline",
        "simulation",
      ])
    })

    it("has correct labels", () => {
      expect(TABS.find((t) => t.id === "details")?.label).toBe("Details")
      expect(TABS.find((t) => t.id === "assets")?.label).toBe("Assets")
      expect(TABS.find((t) => t.id === "fire")?.label).toBe("FIRE")
      expect(TABS.find((t) => t.id === "timeline")?.label).toBe("Timeline")
      expect(TABS.find((t) => t.id === "simulation")?.label).toBe("Simulation")
    })

    it("has correct icons", () => {
      expect(TABS.find((t) => t.id === "details")?.icon).toBe(
        "fa-clipboard-list",
      )
      expect(TABS.find((t) => t.id === "assets")?.icon).toBe("fa-wallet")
      expect(TABS.find((t) => t.id === "fire")?.icon).toBe("fa-fire")
      expect(TABS.find((t) => t.id === "timeline")?.icon).toBe("fa-chart-line")
      expect(TABS.find((t) => t.id === "simulation")?.icon).toBe("fa-dice")
    })
  })
})

describe("hasScenarioChanges", () => {
  it("returns false for default adjustments", () => {
    expect(hasScenarioChanges(DEFAULT_WHAT_IF_ADJUSTMENTS)).toBe(false)
  })

  it("returns true when retirementAgeOffset is changed", () => {
    const adjustments: WhatIfAdjustments = {
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      retirementAgeOffset: 2,
    }
    expect(hasScenarioChanges(adjustments)).toBe(true)
  })

  it("returns true when expensesPercent is changed", () => {
    const adjustments: WhatIfAdjustments = {
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      expensesPercent: 110,
    }
    expect(hasScenarioChanges(adjustments)).toBe(true)
  })

  it("returns true when returnRateOffset is changed", () => {
    const adjustments: WhatIfAdjustments = {
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      returnRateOffset: 1,
    }
    expect(hasScenarioChanges(adjustments)).toBe(true)
  })

  it("returns true when inflationOffset is changed", () => {
    const adjustments: WhatIfAdjustments = {
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      inflationOffset: 0.5,
    }
    expect(hasScenarioChanges(adjustments)).toBe(true)
  })

  it("returns true when contributionPercent is changed", () => {
    const adjustments: WhatIfAdjustments = {
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      contributionPercent: 150,
    }
    expect(hasScenarioChanges(adjustments)).toBe(true)
  })

  it("returns true when equityPercent is set", () => {
    const adjustments: WhatIfAdjustments = {
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      equityPercent: 70,
    }
    expect(hasScenarioChanges(adjustments)).toBe(true)
  })

  it("returns true when liquidationThreshold is changed", () => {
    const adjustments: WhatIfAdjustments = {
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      liquidationThreshold: 20,
    }
    expect(hasScenarioChanges(adjustments)).toBe(true)
  })

  it("returns false when equityPercent is null", () => {
    const adjustments: WhatIfAdjustments = {
      ...DEFAULT_WHAT_IF_ADJUSTMENTS,
      equityPercent: null,
    }
    expect(hasScenarioChanges(adjustments)).toBe(false)
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
