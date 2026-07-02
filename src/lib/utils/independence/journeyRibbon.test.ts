import {
  deriveJourneyRibbon,
  fromSinglePlan,
  fromCompositeRows,
  type NormalizedJourneyRow,
} from "./journeyRibbon"
import type {
  YearlyAccumulation,
  YearlyProjection,
  CompositeYearlyProjection,
} from "types/independence"

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAccumRow(
  age: number,
  endingBalance = 500_000,
): NormalizedJourneyRow {
  return {
    age,
    isAccumulation: true,
    endingBalance,
    unfundedExpense: 0,
    expenses: 0,
    cashflowIncome: 0,
  }
}

function makeDrawdownRow(
  age: number,
  opts: Partial<{
    endingBalance: number
    unfundedExpense: number
    expenses: number
    cashflowIncome: number
  }> = {},
): NormalizedJourneyRow {
  return {
    age,
    isAccumulation: false,
    endingBalance: opts.endingBalance ?? 200_000,
    unfundedExpense: opts.unfundedExpense ?? 0,
    expenses: opts.expenses ?? 80_000,
    cashflowIncome: opts.cashflowIncome ?? 0,
  }
}

// ── deriveJourneyRibbon ───────────────────────────────────────────────────────

describe("deriveJourneyRibbon", () => {
  it("returns empty cells and no verdict for empty input", () => {
    const result = deriveJourneyRibbon([])
    expect(result.cells).toEqual([])
    expect(result.verdict).toBe("")
    expect(result.verdictTone).toBe("good")
  })

  describe("accumulation years", () => {
    it("classifies pre-retirement rows as building", () => {
      const rows = [makeAccumRow(45), makeAccumRow(46), makeAccumRow(47)]
      const { cells } = deriveJourneyRibbon(rows)
      expect(cells.every((c) => c.status === "building")).toBe(true)
    })

    it("generates age note for accumulation rows", () => {
      const { cells } = deriveJourneyRibbon([makeAccumRow(52)])
      expect(cells[0].note).toMatch(/Age 52/)
      expect(cells[0].note).toMatch(/building/)
    })
  })

  describe("covered status", () => {
    it("classifies row as covered when cashflow income covers expenses", () => {
      const rows = [
        makeDrawdownRow(65, { expenses: 80_000, cashflowIncome: 80_000 }),
      ]
      const { cells } = deriveJourneyRibbon(rows)
      expect(cells[0].status).toBe("covered")
    })

    it("classifies row as covered when income exceeds expenses", () => {
      const rows = [
        makeDrawdownRow(67, { expenses: 70_000, cashflowIncome: 90_000 }),
      ]
      const { cells } = deriveJourneyRibbon(rows)
      expect(cells[0].status).toBe("covered")
    })

    it("generates age note for covered rows", () => {
      const rows = [
        makeDrawdownRow(67, { expenses: 60_000, cashflowIncome: 65_000 }),
      ]
      const { cells } = deriveJourneyRibbon(rows)
      expect(cells[0].note).toMatch(/Age 67/)
      expect(cells[0].note).toMatch(/income covers expenses/)
    })
  })

  describe("onTrack status", () => {
    it("classifies row as onTrack when drawing down but no later shortfall", () => {
      const rows = [
        makeDrawdownRow(71, {
          expenses: 80_000,
          cashflowIncome: 30_000,
          endingBalance: 500_000,
        }),
        makeDrawdownRow(72, {
          expenses: 82_000,
          cashflowIncome: 30_000,
          endingBalance: 450_000,
        }),
      ]
      const { cells } = deriveJourneyRibbon(rows)
      expect(cells[0].status).toBe("onTrack")
      expect(cells[1].status).toBe("onTrack")
    })

    it("includes horizonAge in onTrack note", () => {
      const rows = [
        makeDrawdownRow(71, { expenses: 80_000, cashflowIncome: 30_000 }),
        makeDrawdownRow(90, {
          expenses: 100_000,
          cashflowIncome: 30_000,
          endingBalance: 50_000,
        }),
      ]
      const { cells } = deriveJourneyRibbon(rows)
      expect(cells[0].note).toMatch(/90/)
    })
  })

  describe("thinning status", () => {
    it("classifies row as thinning when withdrawing and a later shortfall exists", () => {
      const rows = [
        makeDrawdownRow(78, {
          expenses: 90_000,
          cashflowIncome: 20_000,
          endingBalance: 100_000,
        }),
        makeDrawdownRow(84, {
          expenses: 100_000,
          cashflowIncome: 20_000,
          unfundedExpense: 50_000,
          endingBalance: 0,
        }),
      ]
      const { cells } = deriveJourneyRibbon(rows)
      expect(cells[0].status).toBe("thinning")
    })

    it("includes depletionAge in thinning note", () => {
      const rows = [
        makeDrawdownRow(78, {
          expenses: 90_000,
          cashflowIncome: 20_000,
          endingBalance: 100_000,
        }),
        makeDrawdownRow(84, {
          expenses: 100_000,
          cashflowIncome: 20_000,
          unfundedExpense: 1,
          endingBalance: 0,
        }),
      ]
      const { cells } = deriveJourneyRibbon(rows)
      expect(cells[0].note).toMatch(/84/)
    })
  })

  describe("shortfall status", () => {
    it("classifies row as shortfall when unfundedExpense > 0", () => {
      const rows = [
        makeDrawdownRow(84, { unfundedExpense: 20_000, endingBalance: 0 }),
      ]
      const { cells } = deriveJourneyRibbon(rows)
      expect(cells[0].status).toBe("shortfall")
    })

    it("classifies row as shortfall when endingBalance <= 0", () => {
      const rows = [
        makeDrawdownRow(84, { endingBalance: 0, unfundedExpense: 0 }),
      ]
      const { cells } = deriveJourneyRibbon(rows)
      expect(cells[0].status).toBe("shortfall")
    })

    it("uses 'savings run out this year' note for the first shortfall row", () => {
      const rows = [
        makeDrawdownRow(84, { unfundedExpense: 1, endingBalance: 0 }),
        makeDrawdownRow(85, { unfundedExpense: 1, endingBalance: 0 }),
      ]
      const { cells } = deriveJourneyRibbon(rows)
      expect(cells[0].note).toMatch(/run out this year/)
      expect(cells[1].note).not.toMatch(/run out this year/)
      expect(cells[1].note).toMatch(/unfunded/)
    })

    it("uses guaranteed-income note for later shortfall rows with cashflowIncome > 0", () => {
      const rows = [
        makeDrawdownRow(70, {
          unfundedExpense: 10_000,
          endingBalance: 0,
          cashflowIncome: 30_000,
        }),
        makeDrawdownRow(75, {
          unfundedExpense: 61_200,
          endingBalance: 0,
          cashflowIncome: 30_000,
        }),
      ]
      const { cells } = deriveJourneyRibbon(rows)
      // First shortfall: unchanged
      expect(cells[0].note).toMatch(/run out this year/)
      // Later shortfall with income: guaranteed-income copy
      expect(cells[1].note).toMatch(/savings gone/)
      expect(cells[1].note).toMatch(/guaranteed income covers part/)
    })

    it("rounds unfundedExpense to nearest k in guaranteed-income note", () => {
      const rows = [
        makeDrawdownRow(70, {
          unfundedExpense: 10_000,
          endingBalance: 0,
          cashflowIncome: 5_000,
        }),
        makeDrawdownRow(75, {
          unfundedExpense: 61_200,
          endingBalance: 0,
          cashflowIncome: 5_000,
        }),
      ]
      const { cells } = deriveJourneyRibbon(rows)
      expect(cells[1].note).toContain("61k/yr short")
    })

    it("includes currency prefix in guaranteed-income note", () => {
      const rows = [
        makeDrawdownRow(70, {
          unfundedExpense: 10_000,
          endingBalance: 0,
          cashflowIncome: 5_000,
        }),
        makeDrawdownRow(75, {
          unfundedExpense: 61_000,
          endingBalance: 0,
          cashflowIncome: 5_000,
        }),
      ]
      const { cells } = deriveJourneyRibbon(rows, { currency: "SGD" })
      expect(cells[1].note).toContain("SGD 61k/yr short")
    })

    it("omits currency prefix when currency is empty", () => {
      const rows = [
        makeDrawdownRow(70, {
          unfundedExpense: 10_000,
          endingBalance: 0,
          cashflowIncome: 5_000,
        }),
        makeDrawdownRow(75, {
          unfundedExpense: 61_000,
          endingBalance: 0,
          cashflowIncome: 5_000,
        }),
      ]
      const { cells } = deriveJourneyRibbon(rows, { currency: "" })
      expect(cells[1].note).toContain("(61k/yr short)")
      expect(cells[1].note).not.toContain("SGD")
    })

    it("keeps 'expenses unfunded' for later shortfall rows with no cashflowIncome", () => {
      const rows = [
        makeDrawdownRow(70, {
          unfundedExpense: 10_000,
          endingBalance: 0,
          cashflowIncome: 0,
        }),
        makeDrawdownRow(75, {
          unfundedExpense: 10_000,
          endingBalance: 0,
          cashflowIncome: 0,
        }),
      ]
      const { cells } = deriveJourneyRibbon(rows)
      expect(cells[1].note).toMatch(/expenses unfunded/)
      expect(cells[1].note).not.toMatch(/guaranteed/)
    })

    it("first shortfall note is unchanged even when that row has cashflowIncome", () => {
      const rows = [
        makeDrawdownRow(70, {
          unfundedExpense: 10_000,
          endingBalance: 0,
          cashflowIncome: 30_000,
        }),
      ]
      const { cells } = deriveJourneyRibbon(rows)
      expect(cells[0].note).toMatch(/run out this year/)
    })
  })

  describe("verdict", () => {
    it("returns good verdict when no shortfall", () => {
      const rows = [
        makeDrawdownRow(65, {
          endingBalance: 300_000,
          cashflowIncome: 0,
          expenses: 80_000,
        }),
        makeDrawdownRow(90, {
          endingBalance: 50_000,
          cashflowIncome: 0,
          expenses: 90_000,
        }),
      ]
      const { verdict, verdictTone } = deriveJourneyRibbon(rows)
      expect(verdictTone).toBe("good")
      expect(verdict).toMatch(/90/)
    })

    it("returns bad verdict when final year is depleted", () => {
      const rows = [
        makeDrawdownRow(84, { unfundedExpense: 1, endingBalance: 0 }),
        makeDrawdownRow(90, { unfundedExpense: 1, endingBalance: 0 }),
      ]
      const { verdict, verdictTone, depletionAge } = deriveJourneyRibbon(rows)
      expect(verdictTone).toBe("bad")
      expect(depletionAge).toBe(84)
      expect(verdict).toMatch(/84/)
    })

    it("returns warn verdict when shortfall exists but final year endingBalance > 0 (lumpy expense)", () => {
      const rows = [
        makeDrawdownRow(75, {
          endingBalance: 200_000,
          expenses: 80_000,
          cashflowIncome: 30_000,
        }),
        makeDrawdownRow(80, { unfundedExpense: 5_000, endingBalance: 0 }),
        makeDrawdownRow(85, {
          endingBalance: 100_000,
          expenses: 80_000,
          cashflowIncome: 30_000,
        }),
        makeDrawdownRow(90, {
          endingBalance: 80_000,
          expenses: 80_000,
          cashflowIncome: 30_000,
        }),
      ]
      const { verdictTone } = deriveJourneyRibbon(rows)
      expect(verdictTone).toBe("warn")
    })

    it("includes years short in bad verdict", () => {
      const rows: NormalizedJourneyRow[] = [
        makeDrawdownRow(84, { unfundedExpense: 1, endingBalance: 0 }),
        makeDrawdownRow(85, { unfundedExpense: 1, endingBalance: 0 }),
        makeDrawdownRow(90, { unfundedExpense: 1, endingBalance: 0 }),
      ]
      const { verdict } = deriveJourneyRibbon(rows)
      expect(verdict).toMatch(/84/)
      expect(verdict).toContain("6")
    })
  })

  describe("annuity shortfall verdict", () => {
    it("returns annuity verdict when post-depletion rows have cashflowIncome", () => {
      const rows = [
        makeDrawdownRow(70, {
          unfundedExpense: 10_000,
          endingBalance: 0,
          cashflowIncome: 30_000,
        }),
        makeDrawdownRow(75, {
          unfundedExpense: 61_000,
          endingBalance: 0,
          cashflowIncome: 30_000,
        }),
        makeDrawdownRow(90, {
          unfundedExpense: 61_000,
          endingBalance: 0,
          cashflowIncome: 30_000,
        }),
      ]
      const { verdict } = deriveJourneyRibbon(rows)
      expect(verdict).toMatch(/annuity keeps paying but leaves a shortfall/)
      expect(verdict).toMatch(/70/)
    })

    it("annuity verdict tone is bad when no post-depletion recovery", () => {
      const rows = [
        makeDrawdownRow(70, {
          unfundedExpense: 10_000,
          endingBalance: 0,
          cashflowIncome: 30_000,
        }),
        makeDrawdownRow(75, {
          unfundedExpense: 61_000,
          endingBalance: 0,
          cashflowIncome: 30_000,
        }),
        makeDrawdownRow(90, {
          unfundedExpense: 61_000,
          endingBalance: 0,
          cashflowIncome: 30_000,
        }),
      ]
      const { verdictTone } = deriveJourneyRibbon(rows)
      expect(verdictTone).toBe("bad")
    })

    it("annuity verdict tone is warn when a post-depletion row has no shortfall (recovery)", () => {
      const rows = [
        makeDrawdownRow(70, {
          unfundedExpense: 10_000,
          endingBalance: 0,
          cashflowIncome: 30_000,
        }),
        makeDrawdownRow(75, {
          endingBalance: 50_000,
          expenses: 80_000,
          cashflowIncome: 90_000,
          unfundedExpense: 0,
        }),
      ]
      const { verdictTone } = deriveJourneyRibbon(rows)
      expect(verdictTone).toBe("warn")
    })

    it("opts.depletionAge overrides client-detected depletion age in verdict", () => {
      // Client sees depletion at 71 (first row with endingBalance <= 0)
      // Backend says 70
      const rows = [
        makeDrawdownRow(70, {
          endingBalance: 1,
          unfundedExpense: 0,
          cashflowIncome: 0,
        }),
        makeDrawdownRow(71, {
          endingBalance: 0,
          unfundedExpense: 10_000,
          cashflowIncome: 0,
        }),
        makeDrawdownRow(90, {
          endingBalance: 0,
          unfundedExpense: 10_000,
          cashflowIncome: 0,
        }),
      ]
      const { verdict, depletionAge } = deriveJourneyRibbon(rows, {
        depletionAge: 70,
      })
      expect(depletionAge).toBe(70)
      expect(verdict).toMatch(/70/)
    })

    it("falls back to client-detected depletion age when opts.depletionAge is null", () => {
      const rows = [
        makeDrawdownRow(84, {
          unfundedExpense: 1,
          endingBalance: 0,
          cashflowIncome: 0,
        }),
        makeDrawdownRow(90, {
          unfundedExpense: 1,
          endingBalance: 0,
          cashflowIncome: 0,
        }),
      ]
      const { depletionAge } = deriveJourneyRibbon(rows, { depletionAge: null })
      expect(depletionAge).toBe(84)
    })
  })

  describe("realistic persona: accumulate 45→59, covered 65+, thinning, shortfall 84+", () => {
    const rows: NormalizedJourneyRow[] = [
      // Accumulation
      ...Array.from({ length: 15 }, (_, i) =>
        makeAccumRow(45 + i, 500_000 + i * 50_000),
      ),
      // Drawdown — covered 60–64 (modest income covers)
      ...Array.from({ length: 5 }, (_, i) =>
        makeDrawdownRow(60 + i, {
          expenses: 80_000,
          cashflowIncome: 80_000,
          endingBalance: 900_000 - i * 20_000,
        }),
      ),
      // Covered 65+ (annuity income covers)
      ...Array.from({ length: 10 }, (_, i) =>
        makeDrawdownRow(65 + i, {
          expenses: 90_000,
          cashflowIncome: 95_000,
          endingBalance: 850_000 - i * 30_000,
        }),
      ),
      // Thinning 75–83
      ...Array.from({ length: 9 }, (_, i) =>
        makeDrawdownRow(75 + i, {
          expenses: 100_000,
          cashflowIncome: 30_000,
          endingBalance: 500_000 - i * 50_000,
        }),
      ),
      // Shortfall 84–90
      ...Array.from({ length: 7 }, (_, i) =>
        makeDrawdownRow(84 + i, {
          expenses: 110_000,
          cashflowIncome: 30_000,
          unfundedExpense: 10_000,
          endingBalance: 0,
        }),
      ),
    ]

    it("accumulation rows are all building", () => {
      const { cells } = deriveJourneyRibbon(rows)
      const accum = cells.filter((c) => c.age < 60)
      expect(accum.every((c) => c.status === "building")).toBe(true)
    })

    it("covered rows are all covered", () => {
      const { cells } = deriveJourneyRibbon(rows)
      const covered = cells.filter((c) => c.age >= 60 && c.age < 75)
      expect(covered.every((c) => c.status === "covered")).toBe(true)
    })

    it("thinning rows are all thinning", () => {
      const { cells } = deriveJourneyRibbon(rows)
      const thinning = cells.filter((c) => c.age >= 75 && c.age < 84)
      expect(thinning.every((c) => c.status === "thinning")).toBe(true)
    })

    it("shortfall rows are all shortfall", () => {
      const { cells } = deriveJourneyRibbon(rows)
      const shortfall = cells.filter((c) => c.age >= 84)
      expect(shortfall.every((c) => c.status === "shortfall")).toBe(true)
    })

    it("depletionAge is 84", () => {
      const { depletionAge } = deriveJourneyRibbon(rows)
      expect(depletionAge).toBe(84)
    })
  })

  describe("edge case: never depletes", () => {
    it("all drawdown rows are onTrack when plenty of balance remains", () => {
      const rows = [
        makeAccumRow(50),
        makeDrawdownRow(65, {
          endingBalance: 2_000_000,
          expenses: 80_000,
          cashflowIncome: 20_000,
        }),
        makeDrawdownRow(90, {
          endingBalance: 1_500_000,
          expenses: 100_000,
          cashflowIncome: 20_000,
        }),
      ]
      const { cells, verdictTone, depletionAge } = deriveJourneyRibbon(rows)
      const drawdown = cells.filter((c) => !c.isAccumulation)
      expect(drawdown.every((c) => c.status === "onTrack")).toBe(true)
      expect(verdictTone).toBe("good")
      expect(depletionAge).toBeUndefined()
    })
  })
})

// ── fromSinglePlan ────────────────────────────────────────────────────────────

function makeYearlyAccumulation(
  age: number,
  overrides: Partial<YearlyAccumulation> = {},
): YearlyAccumulation {
  return {
    year: 2000 + age - 45,
    age,
    startingBalance: 400_000,
    contribution: 30_000,
    investmentGrowth: 20_000,
    endingBalance: 450_000 + age * 1_000,
    nonSpendableValue: 0,
    totalWealth: 450_000 + age * 1_000,
    currency: "SGD",
    ...overrides,
  }
}

function makeYearlyProjection(
  age: number,
  overrides: Partial<YearlyProjection> = {},
): YearlyProjection {
  return {
    year: 2000 + age - 45,
    age,
    startingBalance: 800_000,
    investment: 20_000,
    withdrawals: 60_000,
    endingBalance: 760_000,
    inflationAdjustedExpenses: 80_000,
    currency: "SGD",
    nonSpendableValue: 0,
    totalWealth: 760_000,
    ...overrides,
  }
}

describe("fromSinglePlan", () => {
  it("maps accumulation rows as isAccumulation=true", () => {
    const rows = fromSinglePlan([makeYearlyAccumulation(45)], [])
    expect(rows[0].isAccumulation).toBe(true)
  })

  it("maps drawdown rows as isAccumulation=false", () => {
    const rows = fromSinglePlan([], [makeYearlyProjection(60)])
    expect(rows[0].isAccumulation).toBe(false)
  })

  it("computes cashflowIncome as totalIncome minus investmentReturns", () => {
    const proj = makeYearlyProjection(65, {
      incomeBreakdown: {
        investmentReturns: 15_000,
        pension: 20_000,
        socialSecurity: 10_000,
        otherIncome: 5_000,
        rentalIncome: 5_000,
        totalIncome: 55_000,
      },
    })
    const rows = fromSinglePlan([], [proj])
    expect(rows[0].cashflowIncome).toBe(40_000) // 55k - 15k
  })

  it("defaults cashflowIncome to 0 when incomeBreakdown absent", () => {
    const proj = makeYearlyProjection(65, { incomeBreakdown: undefined })
    const rows = fromSinglePlan([], [proj])
    expect(rows[0].cashflowIncome).toBe(0)
  })

  it("maps unfundedExpense from YearlyProjection", () => {
    const proj = makeYearlyProjection(84, { unfundedExpense: 20_000 })
    const rows = fromSinglePlan([], [proj])
    expect(rows[0].unfundedExpense).toBe(20_000)
  })

  it("defaults unfundedExpense to 0 when absent", () => {
    const proj = makeYearlyProjection(84, { unfundedExpense: undefined })
    const rows = fromSinglePlan([], [proj])
    expect(rows[0].unfundedExpense).toBe(0)
  })
})

// ── fromCompositeRows ─────────────────────────────────────────────────────────

function makeCompositeRow(
  age: number,
  overrides: Partial<CompositeYearlyProjection> = {},
): CompositeYearlyProjection {
  return {
    year: 2000 + age - 45,
    age,
    planId: "plan1",
    planName: "Test Plan",
    startingBalance: 500_000,
    investmentReturns: 15_000,
    income: 30_000,
    expenses: 80_000,
    endingBalance: 450_000,
    nonSpendableValue: 0,
    totalWealth: 450_000,
    currency: "SGD",
    ...overrides,
  }
}

describe("fromCompositeRows", () => {
  it("marks first row as accumulation when it has zero expenses and positive endingBalance", () => {
    // Composite accum rows have expenses=0 (pre-retirement)
    const rows = fromCompositeRows([
      makeCompositeRow(50, { expenses: 0, income: 0 }),
    ])
    expect(rows[0].isAccumulation).toBe(true)
  })

  it("marks drawdown rows (non-zero expenses) as isAccumulation=false", () => {
    const rows = fromCompositeRows([
      makeCompositeRow(65, { expenses: 80_000, income: 90_000 }),
    ])
    expect(rows[0].isAccumulation).toBe(false)
  })

  it("uses income field as cashflowIncome when incomeBreakdown is missing", () => {
    const rows = fromCompositeRows([
      makeCompositeRow(65, {
        income: 40_000,
        expenses: 80_000,
        incomeBreakdown: undefined,
      }),
    ])
    expect(rows[0].cashflowIncome).toBe(40_000)
  })

  it("uses totalIncome minus investmentReturns when incomeBreakdown is present", () => {
    const rows = fromCompositeRows([
      makeCompositeRow(65, {
        income: 55_000,
        expenses: 80_000,
        incomeBreakdown: {
          investmentReturns: 15_000,
          pension: 20_000,
          socialSecurity: 10_000,
          otherIncome: 5_000,
          rentalIncome: 5_000,
          totalIncome: 55_000,
        },
      }),
    ])
    expect(rows[0].cashflowIncome).toBe(40_000) // 55k - 15k
  })

  it("maps endingBalance correctly", () => {
    const rows = fromCompositeRows([
      makeCompositeRow(65, { endingBalance: 123_456 }),
    ])
    expect(rows[0].endingBalance).toBe(123_456)
  })
})
