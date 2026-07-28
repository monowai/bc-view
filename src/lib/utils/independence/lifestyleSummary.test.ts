import {
  buildExpenseMix,
  buildLifestyleSummary,
  headroomPhrase,
  ROLLUP_LABEL,
  type ComfortBand,
  type LifestyleSummaryModel,
} from "@lib/independence/lifestyleSummary"
import type {
  LifestyleCatalogResponse,
  PlanExpense,
  RetirementProjection,
} from "types/independence"

/** Two ladders, four rungs each — enough to exercise the scoring. */
const catalog = {
  householdSize: 2,
  currency: "SGD",
  categories: [
    {
      key: "housing",
      displayName: "Housing",
      emoji: "\u{1F3E0}",
      categoryLabelId: "cat-Housing",
      sortOrder: 1,
      tiers: [
        {
          label: "Lean",
          emoji: "\u{1F3E0}",
          monthlyAmount: 500,
          description: "owned outright",
          reserve: false,
        },
        {
          label: "Simple",
          emoji: "\u{1F3E0}",
          monthlyAmount: 1500,
          description: "a modest rental",
          reserve: false,
        },
        {
          label: "Comfortable",
          emoji: "\u{1F3E0}",
          monthlyAmount: 2500,
          description: "a condo rental",
          reserve: false,
        },
        {
          label: "Premium",
          emoji: "\u{1F3E0}",
          monthlyAmount: 4000,
          description: "prime housing",
          reserve: false,
        },
      ],
    },
    {
      key: "food",
      displayName: "Food",
      emoji: "\u{1F37D}",
      categoryLabelId: "cat-Food",
      sortOrder: 2,
      tiers: [
        {
          label: "Lean",
          emoji: "\u{1F37D}",
          monthlyAmount: 400,
          description: "cooking at home",
          reserve: false,
        },
        {
          label: "Simple",
          emoji: "\u{1F37D}",
          monthlyAmount: 900,
          description: "the odd meal out",
          reserve: false,
        },
        {
          label: "Comfortable",
          emoji: "\u{1F37D}",
          monthlyAmount: 1500,
          description: "restaurants most weeks",
          reserve: false,
        },
        {
          label: "Premium",
          emoji: "\u{1F37D}",
          monthlyAmount: 2500,
          description: "eating out by default",
          reserve: false,
        },
      ],
    },
  ],
} as LifestyleCatalogResponse

const expense = (categoryName: string, monthlyAmount: number): PlanExpense => ({
  id: `id-${categoryName}`,
  planId: "plan-1",
  categoryLabelId: `cat-${categoryName}`,
  categoryName,
  monthlyAmount,
  currency: "NZD",
  sortOrder: 0,
})

const projection = (
  overrides: Partial<RetirementProjection> = {},
): RetirementProjection =>
  ({
    currency: "NZD",
    yearlyProjections: [],
    nonSpendableAtRetirement: 0,
    housingReturnRate: 0,
    sustainableMonthlyExpense: 5100,
    expenseAdjustmentPercent: 11,
    ...overrides,
  }) as RetirementProjection

const mix = [
  expense("Housing", 2000),
  expense("Travel", 1200),
  expense("Food", 800),
  expense("Health", 600),
]

describe("comfort, as a summary of the breakdown", () => {
  const bandFor = (entries: Array<[string, number]>): ComfortBand | null =>
    buildExpenseMix({
      expenses: entries.map(([name, amount]) => expense(name, amount)),
      catalog,
    })!.comfort

  it("reads a frugal breakdown as challenging", () => {
    // Bottom rung of every ladder.
    const band = bandFor([
      ["Housing", 500],
      ["Food", 400],
    ])!
    expect(band.key).toBe("challenging")
    expect(band.score).toBeLessThanOrEqual(2)
  })

  it("reads a top-rung breakdown as luxury", () => {
    const band = bandFor([
      ["Housing", 4000],
      ["Food", 2500],
    ])!
    expect(band.key).toBe("luxury")
    expect(band.score).toBe(10)
  })

  it("weights by spend rather than averaging the rungs", () => {
    // Housing sits on the top rung, Food on the bottom. A plain average of the
    // two would land mid-scale; weighting by what each actually costs puts it
    // near the top, because the money is overwhelmingly in the housing.
    const band = bandFor([
      ["Housing", 4000],
      ["Food", 400],
    ])!
    expect(band.score).toBeGreaterThanOrEqual(8)
    expect(band.basedOn).toBe(2)
  })

  it("lets a big frugal category pull the read down", () => {
    const lavishHousingOnly = bandFor([["Housing", 4000]])!
    const sameHousingPlusFrugalFood = bandFor([
      ["Housing", 4000],
      ["Food", 400],
    ])!
    expect(sameHousingPlusFrugalFood.score).toBeLessThan(
      lavishHousingOnly.score,
    )
  })

  it("ignores categories with no ladder rather than scoring them zero", () => {
    // "Ruby" has no bands. Counting it as the bottom rung would drag every
    // plan down for the crime of having a category we haven't described.
    const withCustom = bandFor([
      ["Housing", 2500],
      ["Ruby", 5000],
    ])!
    const without = bandFor([["Housing", 2500]])!
    expect(withCustom.score).toBe(without.score)
    expect(withCustom.basedOn).toBe(1)
  })

  it("says nothing when no category has a ladder", () => {
    expect(bandFor([["Ruby", 500]])).toBeNull()
    // No catalog loaded yet — nothing to place anyone on.
    expect(
      buildExpenseMix({ expenses: [expense("Housing", 2500)] })!.comfort,
    ).toBeNull()
  })

  it("never lets the number disagree with the word", () => {
    const ranges: Record<string, [number, number]> = {
      challenging: [1, 2],
      tight: [3, 4],
      comfortable: [5, 6],
      generous: [7, 8],
      luxury: [9, 10],
    }
    for (let amount = 200; amount <= 6_000; amount += 100) {
      const band = bandFor([["Housing", amount]])!
      const [lo, hi] = ranges[band.key]
      expect(band.score).toBeGreaterThanOrEqual(lo)
      expect(band.score).toBeLessThanOrEqual(hi)
    }
  })

  it("never goes backwards as a budget grows", () => {
    let previous = 0
    for (let amount = 200; amount <= 6_000; amount += 100) {
      const score = bandFor([["Housing", amount]])!.score
      expect(score).toBeGreaterThanOrEqual(previous)
      previous = score
    }
    expect(previous).toBe(10)
  })
})

describe("headroomPhrase", () => {
  const cats = (
    entries: Array<[string, number]>,
    isRollup = false,
  ): LifestyleSummaryModel["categories"] =>
    entries.map(([categoryName, described]) => ({
      categoryName,
      categoryLabelId: `cat-${categoryName}`,
      described,
      amount: described,
      share: 1,
      isRollup,
    }))

  it("measures a surplus against whichever budget it most resembles", () => {
    // +$500 against Entertainment $500 — a whole one.
    const phrase = headroomPhrase({
      monthlyTotal: 4500,
      describedMonthly: 4000,
      categories: cats([
        ["Housing", 2500],
        ["Food", 1000],
        ["Entertainment", 500],
      ]),
    })
    expect(phrase).toBe(
      "everything you planned for, and about a whole Entertainment budget spare",
    )
  })

  it("uses a coarse fraction, not a decimal", () => {
    const phrase = headroomPhrase({
      monthlyTotal: 4250,
      describedMonthly: 4000,
      categories: cats([
        ["Housing", 3000],
        ["Entertainment", 500],
      ]),
    })
    // 250 / 500 — half, not "0.5 of".
    expect(phrase).toBe(
      "everything you planned for, and about half an Entertainment budget spare",
    )
  })

  it("frames a shortfall as what would have to give", () => {
    const phrase = headroomPhrase({
      monthlyTotal: 3500,
      describedMonthly: 4000,
      categories: cats([
        ["Housing", 3000],
        ["Travel", 500],
      ]),
    })
    expect(phrase).toBe("the plan falls short by about a whole Travel budget")
  })

  it("calls a negligible gap the same life", () => {
    const phrase = headroomPhrase({
      monthlyTotal: 4020,
      describedMonthly: 4000,
      categories: cats([["Housing", 4000]]),
    })
    expect(phrase).toBe("just about exactly the life you described")
  })

  it("reads as a sentence when the category is a person's name", () => {
    // "Your whole Ruby budget more than the plan can cover." stated a
    // comparison without ever making it, and "your ... Ruby" reads oddly.
    const phrase = headroomPhrase({
      monthlyTotal: 3500,
      describedMonthly: 4000,
      categories: cats([
        ["Housing", 3000],
        ["Ruby", 500],
      ]),
    })
    expect(phrase).toBe("the plan falls short by about a whole Ruby budget")
  })

  it.each([
    ["Entertainment", "an Entertainment"],
    ["Other", "an Other"],
    // "u" is a vowel whose sound usually isn't — Utilities takes "a".
    ["Utilities", "a Utilities"],
    ["Housing", "a Housing"],
  ])("gets the article right for %s", (category, expected) => {
    const phrase = headroomPhrase({
      monthlyTotal: 4250,
      describedMonthly: 4000,
      categories: cats([
        ["Housing", 3000],
        [category, 500],
      ]),
    })
    expect(phrase).toContain(`half ${expected} budget`)
  })

  it("pluralises a quantity over one", () => {
    const phrase = headroomPhrase({
      monthlyTotal: 5000,
      describedMonthly: 4000,
      categories: cats([
        ["Housing", 3500],
        ["Travel", 500],
      ]),
    })
    expect(phrase).toBe(
      "everything you planned for, and about two Travel budgets spare",
    )
  })

  it("won't measure against the rolled-up remainder", () => {
    // "Half your Everything else budget" means nothing to anyone.
    const phrase = headroomPhrase({
      monthlyTotal: 4500,
      describedMonthly: 4000,
      categories: cats([["Everything else", 4000]], true),
    })
    expect(phrase).toBeNull()
  })
})

describe("buildExpenseMix", () => {
  it("still gets a comfort read — it needs no projection", () => {
    // The band summarises the category ladders, so a composite phase can have
    // one even though the composite projection has no sustainable figure.
    expect(buildExpenseMix({ expenses: mix, catalog })!.comfort).not.toBeNull()
  })

  it("reports what was described, making no affordability claim", () => {
    const model = buildExpenseMix({ expenses: mix })!

    expect(model.basis).toBe("described")
    expect(model.monthlyTotal).toBe(4600)
    expect(model.categories.map((c) => c.amount)).toEqual([
      2000, 1200, 800, 600,
    ])
  })

  it("never carries an adjustment or a liquidation figure", () => {
    // Both come off a projection this basis deliberately never consults.
    const model = buildExpenseMix({ expenses: mix })!

    expect(model.adjustmentPercent).toBeNull()
    expect(model.direction).toBe("level")
    expect(model.liquidation).toBeNull()
  })

  it("sizes bars against the largest category", () => {
    const model = buildExpenseMix({
      expenses: [expense("Housing", 2000), expense("Food", 500)],
    })!

    expect(model.categories[0].share).toBe(1)
    expect(model.categories[1].share).toBeCloseTo(0.25)
  })

  it("rolls the tail up like the supported basis does", () => {
    const model = buildExpenseMix({
      expenses: [
        expense("A", 100),
        expense("B", 90),
        expense("C", 80),
        expense("D", 70),
        expense("E", 60),
        expense("F", 50),
        expense("G", 40),
      ],
      maxCategories: 5,
    })!

    expect(model.categories).toHaveLength(6)
    expect(model.categories[5].categoryName).toBe(ROLLUP_LABEL)
    expect(model.categories[5].amount).toBe(90)
  })

  it("still describes the mix", () => {
    const model = buildExpenseMix({
      expenses: [expense("Housing", 3000), expense("Food", 500)],
    })!
    expect(model.mixDescriptor).toBe("Housing-dominant")
  })

  it("returns null when nothing was described", () => {
    expect(buildExpenseMix({ expenses: [] })).toBeNull()
    expect(buildExpenseMix({ expenses: [expense("Housing", 0)] })).toBeNull()
  })
})

describe("category descriptions", () => {
  const labels = [
    {
      id: "cat-Healthcare",
      ownerId: "SYSTEM",
      name: "Healthcare",
      description: "Medical, dental, vision, insurance",
      sortOrder: 1,
    },
    {
      id: "cat-Housing",
      ownerId: "SYSTEM",
      name: "Housing",
      description: "Rates, management fees, insurance, maintenance",
      sortOrder: 2,
    },
  ]

  it("attaches the backend's own words for each bucket", () => {
    const model = buildLifestyleSummary({
      expenses: [expense("Housing", 2000), expense("Healthcare", 600)],
      projection: projection(),
      labels,
    })!
    expect(model.categories[0].description).toBe(
      "Rates, management fees, insurance, maintenance",
    )
    expect(model.categories[1].description).toBe(
      "Medical, dental, vision, insurance",
    )
  })

  it("leaves a user's own category undescribed rather than inventing one", () => {
    const model = buildLifestyleSummary({
      expenses: [expense("Housing", 2000), expense("Ruby", 500)],
      projection: projection(),
      labels,
    })!
    expect(model.categories[1].description).toBeUndefined()
  })

  it("has the remainder describe itself by what it swallowed", () => {
    const model = buildLifestyleSummary({
      expenses: [
        expense("Housing", 600),
        expense("Food", 500),
        expense("Travel", 400),
        expense("Health", 300),
        expense("Pets", 200),
        expense("Golf", 100),
        expense("Books", 50),
      ],
      projection: projection(),
      labels,
      maxCategories: 5,
    })!
    expect(model.categories[5].description).toBe("Golf, Books")
  })

  it("works without labels at all", () => {
    const model = buildLifestyleSummary({
      expenses: [expense("Housing", 2000)],
      projection: projection(),
    })!
    expect(model.categories[0].description).toBeUndefined()
  })

  it("prefers the catalog tier over the category's own description", () => {
    const model = buildLifestyleSummary({
      expenses: [expense("Housing", 2500)],
      projection: projection({ sustainableMonthlyExpense: 2500 }),
      labels,
      catalog,
    })!
    expect(model.categories[0].benchmark).toBe("a condo rental")
    expect(model.categories[0].emoji).toBe("\u{1F3E0}")
    // The description is still carried; the component decides which to show.
    expect(model.categories[0].description).toBe(
      "Rates, management fees, insurance, maintenance",
    )
  })

  it("places the supported amount on the ladder, not the described one", () => {
    // Labelling the life the user typed rather than the one the plan pays for
    // would describe a standard of living they can't actually reach.
    const model = buildLifestyleSummary({
      expenses: [expense("Housing", 4000)],
      projection: projection({ sustainableMonthlyExpense: 500 }),
      labels,
      catalog,
    })!
    expect(model.categories[0].amount).toBe(500)
    expect(model.categories[0].benchmark).toBe("owned outright")
  })

  it("carries no tier until the catalog has loaded", () => {
    const model = buildLifestyleSummary({
      expenses: [expense("Housing", 2500)],
      projection: projection(),
      labels,
    })!
    expect(model.categories[0].benchmark).toBeUndefined()
    expect(model.categories[0].emoji).toBeUndefined()
  })

  it("carries descriptions on the described basis too", () => {
    const model = buildExpenseMix({
      expenses: [expense("Healthcare", 600)],
      labels,
    })!
    expect(model.categories[0].description).toBe(
      "Medical, dental, vision, insurance",
    )
  })
})

describe("buildLifestyleSummary", () => {
  it("is flagged as making an affordability claim", () => {
    expect(
      buildLifestyleSummary({ expenses: mix, projection: projection() })!.basis,
    ).toBe("supported")
  })

  it("scales each described category to what the plan supports", () => {
    const model = buildLifestyleSummary({
      expenses: [expense("Housing", 2000), expense("Travel", 2000)],
      projection: projection({ sustainableMonthlyExpense: 3000 }),
    })!

    expect(model.categories.map((c) => c.amount)).toEqual([1500, 1500])
  })

  it("makes the rows add up to the headline despite rounding", () => {
    const model = buildLifestyleSummary({
      expenses: [expense("A", 333), expense("B", 333), expense("C", 334)],
      projection: projection({ sustainableMonthlyExpense: 1001 }),
    })!

    const total = model.categories.reduce((sum, c) => sum + c.amount, 0)
    expect(total).toBe(1001)
  })

  it("rolls the tail into a single remainder row", () => {
    const model = buildLifestyleSummary({
      expenses: [
        expense("Housing", 2000),
        expense("Travel", 1000),
        expense("Food", 500),
        expense("Health", 100),
        expense("Pets", 50),
        expense("Golf", 40),
        expense("Books", 10),
      ],
      projection: projection({ sustainableMonthlyExpense: 3700 }),
      maxCategories: 5,
    })!

    expect(model.categories).toHaveLength(6)
    const rollup = model.categories[5]
    expect(rollup.categoryName).toBe(ROLLUP_LABEL)
    expect(rollup.isRollup).toBe(true)
    // Pets makes the top 5; only Golf + Books fall into the remainder
    expect(rollup.described).toBe(50)
  })

  it("ranks categories by amount, largest first", () => {
    const model = buildLifestyleSummary({
      expenses: [expense("Food", 800), expense("Housing", 2000)],
      projection: projection(),
    })!

    expect(model.categories.map((c) => c.categoryName)).toEqual([
      "Housing",
      "Food",
    ])
  })

  it("sizes bars against the largest category, not the total", () => {
    const model = buildLifestyleSummary({
      expenses: [expense("Housing", 2000), expense("Food", 1000)],
      projection: projection({ sustainableMonthlyExpense: 3000 }),
    })!

    expect(model.categories[0].share).toBe(1)
    expect(model.categories[1].share).toBeCloseTo(0.5)
  })

  it("ignores categories the user left at zero", () => {
    const model = buildLifestyleSummary({
      expenses: [expense("Housing", 2000), expense("Yacht", 0)],
      projection: projection(),
    })!

    expect(model.categories.map((c) => c.categoryName)).toEqual(["Housing"])
  })

  describe("direction", () => {
    it("reads headroom from the backend adjustment", () => {
      const model = buildLifestyleSummary({
        expenses: mix,
        projection: projection({ expenseAdjustmentPercent: 11 }),
      })!
      expect(model.direction).toBe("headroom")
      expect(model.adjustmentPercent).toBe(11)
    })

    it("reads shortfall from the backend adjustment", () => {
      const model = buildLifestyleSummary({
        expenses: mix,
        projection: projection({ expenseAdjustmentPercent: -20 }),
      })!
      expect(model.direction).toBe("shortfall")
    })

    it("treats a sub-1% adjustment as level", () => {
      const model = buildLifestyleSummary({
        expenses: mix,
        projection: projection({ expenseAdjustmentPercent: 0.4 }),
      })!
      expect(model.direction).toBe("level")
    })

    it("is level when the backend sends no adjustment", () => {
      const model = buildLifestyleSummary({
        expenses: mix,
        projection: projection({ expenseAdjustmentPercent: undefined }),
      })!
      expect(model.direction).toBe("level")
      expect(model.adjustmentPercent).toBeNull()
    })
  })

  describe("mix descriptor", () => {
    it("names a category that dominates the mix", () => {
      const model = buildLifestyleSummary({
        expenses: [expense("Housing", 3000), expense("Food", 500)],
        projection: projection(),
      })!
      expect(model.mixDescriptor).toBe("Housing-dominant")
    })

    it("names a category that merely leans heavy", () => {
      const model = buildLifestyleSummary({
        expenses: [
          expense("Travel", 300),
          expense("Food", 250),
          expense("Housing", 250),
          expense("Health", 200),
        ],
        projection: projection(),
      })!
      expect(model.mixDescriptor).toBe("Travel-heavy")
    })

    it("calls an even spread balanced", () => {
      const model = buildLifestyleSummary({
        expenses: [
          expense("A", 100),
          expense("B", 100),
          expense("C", 100),
          expense("D", 100),
          expense("E", 100),
          expense("F", 100),
        ],
        projection: projection(),
      })!
      expect(model.mixDescriptor).toBe("Balanced")
    })
  })

  describe("liquidation", () => {
    it("surfaces the with-liquidation figure when it is better", () => {
      const model = buildLifestyleSummary({
        expenses: mix,
        projection: projection({
          sustainableMonthlyExpense: 5100,
          sustainableWithLiquidation: 6300,
          liquidationAge: 71,
        }),
      })!
      expect(model.liquidation).toEqual({
        supportedMonthly: 6300,
        fromAge: 71,
      })
    })

    it("stays quiet when selling up buys nothing", () => {
      const model = buildLifestyleSummary({
        expenses: mix,
        projection: projection({
          sustainableMonthlyExpense: 5100,
          sustainableWithLiquidation: 5100,
        }),
      })!
      expect(model.liquidation).toBeNull()
    })
  })

  describe("nothing honest to say", () => {
    it("returns null when no expenses were described", () => {
      expect(
        buildLifestyleSummary({ expenses: [], projection: projection() }),
      ).toBeNull()
    })

    it("returns null when every category is zero", () => {
      expect(
        buildLifestyleSummary({
          expenses: [expense("Housing", 0)],
          projection: projection(),
        }),
      ).toBeNull()
    })

    it("returns null when the backend has no sustainable figure", () => {
      expect(
        buildLifestyleSummary({
          expenses: mix,
          projection: projection({ sustainableMonthlyExpense: undefined }),
        }),
      ).toBeNull()
    })

    it("returns null without a projection at all", () => {
      expect(
        buildLifestyleSummary({ expenses: mix, projection: null }),
      ).toBeNull()
    })
  })

  it("survives a plan the projection cannot sustain at all", () => {
    const model = buildLifestyleSummary({
      expenses: mix,
      projection: projection({
        sustainableMonthlyExpense: 0,
        expenseAdjustmentPercent: -100,
      }),
    })!

    expect(model.monthlyTotal).toBe(0)
    expect(model.categories.every((c) => c.amount === 0)).toBe(true)
    expect(model.categories.every((c) => c.share === 0)).toBe(true)
    expect(model.direction).toBe("shortfall")
  })
})
