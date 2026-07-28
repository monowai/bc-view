import { tierLevelFor } from "@lib/independence/lifestyleTiers"
import type { LifestyleCatalogResponse } from "types/independence"

const catalog = {
  householdSize: 2,
  currency: "SGD",
  categories: [
    {
      key: "housing",
      displayName: "Housing",
      emoji: "🏠",
      categoryLabelId: "cat-Housing",
      sortOrder: 1,
      tiers: [
        {
          label: "Lean",
          emoji: "🏠",
          monthlyAmount: 500,
          description: "owned outright",
          reserve: false,
        },
        {
          label: "Comfortable",
          emoji: "🏡",
          monthlyAmount: 2500,
          description: "a condo rental",
          reserve: false,
        },
        {
          label: "Premium",
          emoji: "🏘️",
          monthlyAmount: 4000,
          description: "prime housing",
          reserve: false,
        },
      ],
    },
  ],
} as LifestyleCatalogResponse

describe("tierLevelFor", () => {
  it("places a spend on the nearest tier", () => {
    expect(tierLevelFor("cat-Housing", 2400, catalog)).toEqual({
      descriptor: "a condo rental",
      emoji: "🏡",
      index: 2,
      of: 3,
    })
  })

  it("matches on the catalog's own id, never the category name", () => {
    // The catalog and the plan's expenses share categoryLabelId, so nothing
    // here has to guess from a display name — which is how "Healthcare"
    // previously matched a rule meant for "car".
    expect(tierLevelFor("Housing", 2400, catalog)).toBeNull()
  })

  it("clamps to the ends rather than falling off them", () => {
    expect(tierLevelFor("cat-Housing", 10, catalog)?.index).toBe(1)
    expect(tierLevelFor("cat-Housing", 99_999, catalog)?.index).toBe(3)
  })

  it("says nothing for a category the catalog doesn't cover", () => {
    expect(tierLevelFor("cat-Ruby", 500, catalog)).toBeNull()
  })

  it("says nothing before the catalog loads", () => {
    expect(tierLevelFor("cat-Housing", 2500, undefined)).toBeNull()
  })

  it("says nothing about a zero or negative amount", () => {
    expect(tierLevelFor("cat-Housing", 0, catalog)).toBeNull()
    expect(tierLevelFor("cat-Housing", -100, catalog)).toBeNull()
  })
})
