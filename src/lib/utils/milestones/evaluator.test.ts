import { evaluateAll, findNewMilestones } from "./evaluator"
import { EarnedMilestone, MilestoneEvalData } from "./types"

const noEarned: EarnedMilestone[] = []

describe("evaluateAll", () => {
  it("returns all milestone states for empty data", () => {
    const states = evaluateAll({}, noEarned)
    expect(states.length).toBeGreaterThan(0)
    // With empty data, no non-explorer milestones should be earned
    const earned = states.filter(
      (s) => s.earnedTier !== null && s.definition.category !== "explorer",
    )
    expect(earned).toHaveLength(0)
  })

  describe("portfolio-builder", () => {
    it("returns null for 0 portfolios", () => {
      const states = evaluateAll({ portfolioCount: 0 }, noEarned)
      const pb = states.find((s) => s.definition.id === "portfolio-builder")!
      expect(pb.earnedTier).toBeNull()
    })

    it("returns tier 1 for 1 portfolio", () => {
      const states = evaluateAll({ portfolioCount: 1 }, noEarned)
      const pb = states.find((s) => s.definition.id === "portfolio-builder")!
      expect(pb.earnedTier).toBe(1)
    })

    it("returns tier 2 for 3 portfolios", () => {
      const states = evaluateAll({ portfolioCount: 3 }, noEarned)
      const pb = states.find((s) => s.definition.id === "portfolio-builder")!
      expect(pb.earnedTier).toBe(2)
    })

    it("returns tier 3 for 5+ portfolios", () => {
      const states = evaluateAll({ portfolioCount: 7 }, noEarned)
      const pb = states.find((s) => s.definition.id === "portfolio-builder")!
      expect(pb.earnedTier).toBe(3)
      expect(pb.nextTier).toBeNull()
    })
  })

  describe("diversified", () => {
    it("returns tier 1 for 5 positions", () => {
      const states = evaluateAll({ positionCount: 5 }, noEarned)
      const d = states.find((s) => s.definition.id === "diversified")!
      expect(d.earnedTier).toBe(1)
    })

    it("returns tier 3 for 20+ positions", () => {
      const states = evaluateAll({ positionCount: 25 }, noEarned)
      const d = states.find((s) => s.definition.id === "diversified")!
      expect(d.earnedTier).toBe(3)
    })
  })

  describe("balanced", () => {
    it("returns tier 1 when max weight <= 50%", () => {
      const states = evaluateAll({ maxPositionWeight: 45 }, noEarned)
      const b = states.find((s) => s.definition.id === "balanced")!
      expect(b.earnedTier).toBe(1)
    })

    it("returns tier 3 when max weight <= 20%", () => {
      const states = evaluateAll({ maxPositionWeight: 18 }, noEarned)
      const b = states.find((s) => s.definition.id === "balanced")!
      expect(b.earnedTier).toBe(3)
    })

    it("returns null when max weight > 50%", () => {
      const states = evaluateAll({ maxPositionWeight: 60 }, noEarned)
      const b = states.find((s) => s.definition.id === "balanced")!
      expect(b.earnedTier).toBeNull()
    })
  })

  describe("fi-progress", () => {
    it("returns tier 1 at 10%", () => {
      const states = evaluateAll({ fiProgress: 10 }, noEarned)
      const fi = states.find((s) => s.definition.id === "fi-progress")!
      expect(fi.earnedTier).toBe(1)
    })

    it("returns tier 3 at 100%", () => {
      const states = evaluateAll({ fiProgress: 100 }, noEarned)
      const fi = states.find((s) => s.definition.id === "fi-progress")!
      expect(fi.earnedTier).toBe(3)
    })
  })

  describe("net-worth", () => {
    it("returns null below $10K", () => {
      const states = evaluateAll({ netWorthUsd: 5000 }, noEarned)
      const nw = states.find((s) => s.definition.id === "net-worth")!
      expect(nw.earnedTier).toBeNull()
    })

    it("returns tier 1 at $10K", () => {
      const states = evaluateAll({ netWorthUsd: 10000 }, noEarned)
      const nw = states.find((s) => s.definition.id === "net-worth")!
      expect(nw.earnedTier).toBe(1)
    })

    it("returns tier 3 at $1M", () => {
      const states = evaluateAll({ netWorthUsd: 1_500_000 }, noEarned)
      const nw = states.find((s) => s.definition.id === "net-worth")!
      expect(nw.earnedTier).toBe(3)
    })
  })

  describe("hodler", () => {
    it("returns tier 1 for 1 year", () => {
      const states = evaluateAll({ oldestPositionYears: 1 }, noEarned)
      const h = states.find((s) => s.definition.id === "hodler")!
      expect(h.earnedTier).toBe(1)
    })

    it("returns tier 3 for 5+ years", () => {
      const states = evaluateAll({ oldestPositionYears: 6 }, noEarned)
      const h = states.find((s) => s.definition.id === "hodler")!
      expect(h.earnedTier).toBe(3)
    })
  })

  it("uses higher of computed vs previously earned tier", () => {
    const earned: EarnedMilestone[] = [
      {
        id: "m1",
        milestoneId: "portfolio-builder",
        tier: 3,
        earnedAt: "2025-01-01",
      },
    ]
    // User now has only 1 portfolio, but was previously tier 3
    const states = evaluateAll({ portfolioCount: 1 }, earned)
    const pb = states.find((s) => s.definition.id === "portfolio-builder")!
    expect(pb.earnedTier).toBe(3) // Never downgrades
  })

  it("explorer milestones use earned data, not computed", () => {
    const earned: EarnedMilestone[] = [
      {
        id: "m1",
        milestoneId: "view-switcher",
        tier: 2,
        earnedAt: "2025-01-01",
      },
    ]
    const states = evaluateAll({}, earned)
    const vs = states.find((s) => s.definition.id === "view-switcher")!
    expect(vs.earnedTier).toBe(2)
  })
})

describe("findNewMilestones", () => {
  it("detects newly earned milestones", () => {
    const data: MilestoneEvalData = {
      portfolioCount: 3,
      positionCount: 5,
    }
    const newMilestones = findNewMilestones(data, noEarned)
    const ids = newMilestones.map((m) => m.milestoneId)
    expect(ids).toContain("portfolio-builder")
    expect(ids).toContain("diversified")
  })

  it("skips already earned milestones at same tier", () => {
    const earned: EarnedMilestone[] = [
      {
        id: "m1",
        milestoneId: "portfolio-builder",
        tier: 2,
        earnedAt: "2025-01-01",
      },
    ]
    const data: MilestoneEvalData = { portfolioCount: 3 }
    const newMilestones = findNewMilestones(data, earned)
    const pb = newMilestones.find((m) => m.milestoneId === "portfolio-builder")
    expect(pb).toBeUndefined()
  })

  it("detects tier upgrade", () => {
    const earned: EarnedMilestone[] = [
      {
        id: "m1",
        milestoneId: "portfolio-builder",
        tier: 1,
        earnedAt: "2025-01-01",
      },
    ]
    const data: MilestoneEvalData = { portfolioCount: 5 }
    const newMilestones = findNewMilestones(data, earned)
    const pb = newMilestones.find((m) => m.milestoneId === "portfolio-builder")
    expect(pb).toBeDefined()
    expect(pb!.tier).toBe(3)
  })

  it("ignores explorer milestones", () => {
    const data: MilestoneEvalData = {}
    const newMilestones = findNewMilestones(data, noEarned)
    const explorerIds = newMilestones.filter(
      (m) =>
        m.milestoneId === "view-switcher" ||
        m.milestoneId === "analyst" ||
        m.milestoneId === "currency-traveller",
    )
    expect(explorerIds).toHaveLength(0)
  })
})
