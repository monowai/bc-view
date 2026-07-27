import {
  fitToBudget,
  categoryMonthlyTotal,
  boardMonthlyTotal,
  lifestyleHeadline,
  isCustomAmount,
  nearestTierIndex,
} from "../lifestyleBoard"
import { makeLifestyleCatalog } from "@components/features/independence/__fixtures__/lifestyleCatalog"

describe("lifestyleBoard", () => {
  const catalog = makeLifestyleCatalog()
  const categories = catalog.categories

  describe("fitToBudget", () => {
    it("returns the cheapest tier for every category at the floor budget", () => {
      const floor = categoryMonthlyTotal(categories, () => 0)
      const result = fitToBudget(categories, floor)
      categories.forEach((c) => {
        expect(result[c.key]).toBe(0)
      })
    })

    it("upgrades higher-priority (lower sortOrder) categories before lower-priority ones of similar cost", () => {
      // groceries (sortOrder 2, high weight) and dining (sortOrder 8, low
      // weight) both have a ~$300 first-upgrade delta. The weighted score
      // (delta / weight) favours groceries, so it should be upgraded
      // first when only one $300ish upgrade fits the budget.
      const floor = categoryMonthlyTotal(categories, () => 0)
      const result = fitToBudget(categories, floor + 300)
      expect(result.groceries).toBeGreaterThan(0)
      expect(result.dining).toBe(0)
    })

    it("never selects a reserve tier before all non-reserve tiers are maxed for a huge budget bump relative to peers", () => {
      // At a budget that easily affords one small upgrade, reserve tiers
      // (penalised 3x) should not be picked over a cheaper non-reserve
      // upgrade elsewhere.
      const floor = categoryMonthlyTotal(categories, () => 0)
      const result = fitToBudget(categories, floor + 400)
      const health = categories.find((c) => c.key === "health")!
      expect(result.health).toBeLessThan(health.tiers.length - 1) // not at reserve tier
    })

    it("only reaches a reserve tier once the budget is large enough", () => {
      const ceiling = categoryMonthlyTotal(
        categories,
        (c) => c.tiers.length - 1,
      )
      const result = fitToBudget(categories, ceiling)
      const health = categories.find((c) => c.key === "health")!
      expect(result.health).toBe(health.tiers.length - 1)
    })

    it("never exceeds the given budget", () => {
      const budget = 5000
      const result = fitToBudget(categories, budget)
      const spent = boardMonthlyTotal(categories, result)
      expect(spent).toBeLessThanOrEqual(budget)
    })
  })

  describe("boardMonthlyTotal / categoryMonthlyTotal", () => {
    it("sums the selected tier cost per category", () => {
      const selection = Object.fromEntries(categories.map((c) => [c.key, 0]))
      const total = boardMonthlyTotal(categories, selection)
      const expected = categories.reduce(
        (s, c) => s + c.tiers[0].monthlyAmount,
        0,
      )
      expect(total).toBe(expected)
    })
  })

  describe("lifestyleHeadline", () => {
    it.each([
      [1000, "Lean & Intentional"],
      [8000, "Comfortable"],
      [30000, "High Flyer"],
    ])("labels %i/mo as %s", (amount, label) => {
      expect(lifestyleHeadline(amount)).toBe(label)
    })
  })

  describe("isCustomAmount", () => {
    it("is false when the amount matches the selected tier anchor", () => {
      const housing = categories.find((c) => c.key === "housing")!
      expect(
        isCustomAmount(housing.tiers[1].monthlyAmount, housing.tiers[1]),
      ).toBe(false)
    })

    it("is true when the amount was edited away from the tier anchor", () => {
      const housing = categories.find((c) => c.key === "housing")!
      expect(
        isCustomAmount(housing.tiers[1].monthlyAmount + 37, housing.tiers[1]),
      ).toBe(true)
    })
  })

  describe("nearestTierIndex", () => {
    it("finds the closest tier by absolute distance", () => {
      const housing = categories.find((c) => c.key === "housing")!
      // Between Modest(1200) and Comfortable(2200), 1700 is closer to Comfortable? No, exactly mid — pick lower tier on tie.
      expect(nearestTierIndex(1250, housing.tiers)).toBe(0)
      expect(nearestTierIndex(2100, housing.tiers)).toBe(1)
    })
  })
})
