import type { IncomeBreakdown, PlanExpense } from "types/independence"
import {
  buildYearFlows,
  expenseShares,
  typicalYear,
  type FlowNode,
} from "./yearFlows"

function breakdown(overrides: Partial<IncomeBreakdown> = {}): IncomeBreakdown {
  return {
    investmentReturns: 0,
    pension: 0,
    socialSecurity: 0,
    otherIncome: 0,
    rentalIncome: 0,
    totalIncome: 0,
    ...overrides,
  }
}

const summary = (nodes: FlowNode[]): [string, number, boolean][] =>
  nodes.map((n) => [n.label, n.value, n.residual])

const sum = (nodes: FlowNode[]): number =>
  nodes.reduce((total, n) => total + n.value, 0)

describe("buildYearFlows", () => {
  it("should fan salary out to living expenses and a labelled surplus in a working year", () => {
    const flows = buildYearFlows({
      expenses: 60_000,
      incomeBreakdown: breakdown({
        workingIncome: 120_000,
        investmentReturns: 30_000,
      }),
    })

    expect(summary(flows.sources)).toEqual([["Salary", 120_000, false]])
    expect(summary(flows.uses)).toEqual([
      ["Living expenses", 60_000, false],
      ["Surplus to portfolio", 60_000, true],
    ])
    expect(flows.total).toBe(120_000)
  })

  it("should fund retirement expenses from pensions plus a portfolio withdrawal", () => {
    const flows = buildYearFlows({
      inflationAdjustedExpenses: 80_000,
      incomeBreakdown: breakdown({
        pension: 20_000,
        assetPensions: 15_000,
        investmentReturns: 40_000,
      }),
    })

    expect(summary(flows.sources)).toEqual([
      ["Pension", 20_000, false],
      ["Private Pension", 15_000, false],
      ["From portfolio", 45_000, true],
    ])
    expect(summary(flows.uses)).toEqual([["Living expenses", 80_000, false]])
    expect(sum(flows.sources)).toBe(sum(flows.uses))
  })

  it("should render a year with only expenses as one source and one use", () => {
    const flows = buildYearFlows({ inflationAdjustedExpenses: 50_000 })

    expect(summary(flows.sources)).toEqual([["From portfolio", 50_000, true]])
    expect(summary(flows.uses)).toEqual([["Living expenses", 50_000, false]])
  })

  it("should show the unfunded part of a withdrawal as a shortfall, never a negative flow", () => {
    const flows = buildYearFlows({
      inflationAdjustedExpenses: 50_000,
      unfundedExpense: 10_000,
    })

    expect(flows.sources.map((n) => [n.label, n.value, n.kind])).toEqual([
      ["From portfolio", 40_000, "portfolio"],
      ["Unfunded shortfall", 10_000, "shortfall"],
    ])
    expect(flows.sources.every((n) => n.value > 0)).toBe(true)
    expect(flows.uses.every((n) => n.value > 0)).toBe(true)
  })

  it("should add life events and withdrawal tax and still balance", () => {
    const flows = buildYearFlows({
      inflationAdjustedExpenses: 40_000,
      withdrawalTaxPaid: 3_000,
      incomeBreakdown: breakdown({
        socialSecurity: 18_000,
        rentalIncome: 12_000,
        otherIncome: 1_000,
        lumpSumPayout: 25_000,
        lifeEventIncome: 5_000,
        lifeEventExpense: 30_000,
      }),
    })

    expect(flows.sources.map((n) => n.label)).toEqual([
      "Govt Benefits",
      "Rental",
      "Other income",
      "Lump Sum",
      "Life event income",
      "From portfolio",
    ])
    expect(summary(flows.uses)).toEqual([
      ["Living expenses", 40_000, false],
      ["Life event expense", 30_000, false],
      ["Withdrawal tax", 3_000, false],
    ])
    expect(sum(flows.sources)).toBe(sum(flows.uses))
  })

  it("should read composite rows, which carry expenses rather than inflationAdjustedExpenses", () => {
    const flows = buildYearFlows({
      expenses: 30_000,
      incomeBreakdown: breakdown({ pension: 30_000 }),
    })

    expect(summary(flows.sources)).toEqual([["Pension", 30_000, false]])
    expect(summary(flows.uses)).toEqual([["Living expenses", 30_000, false]])
  })

  it("should omit rounding noise rather than draw a sliver", () => {
    const flows = buildYearFlows({
      expenses: 10_000.3,
      incomeBreakdown: breakdown({ pension: 10_000 }),
    })

    expect(flows.sources.map((n) => n.label)).toEqual(["Pension"])
    expect(flows.uses.map((n) => n.label)).toEqual(["Living expenses"])
  })

  it("should return no flows for a year with no cash movement", () => {
    expect(buildYearFlows({ expenses: 0 })).toEqual({
      sources: [],
      uses: [],
      total: 0,
    })
  })

  it("should split living expenses across the stage's categories by their share", () => {
    const flows = buildYearFlows(
      {
        inflationAdjustedExpenses: 120_000,
        incomeBreakdown: breakdown({ pension: 20_000 }),
      },
      [
        { key: "housing", label: "Housing", share: 0.5 },
        { key: "food", label: "Food", share: 0.25 },
        { key: "travel", label: "Travel", share: 0.25 },
      ],
    )

    expect(flows.uses.map((n) => [n.label, n.value, n.group ?? null])).toEqual([
      ["Housing", 60_000, "Living expenses"],
      ["Food", 30_000, "Living expenses"],
      ["Travel", 30_000, "Living expenses"],
    ])
    expect(sum(flows.uses)).toBe(sum(flows.sources))
  })

  it("should keep living expenses whole when a category would round away", () => {
    const flows = buildYearFlows({ expenses: 2 }, [
      { key: "housing", label: "Housing", share: 0.8 },
      { key: "food", label: "Food", share: 0.2 },
    ])

    expect(summary(flows.uses)).toEqual([["Living expenses", 2, false]])
    expect(summary(flows.sources)).toEqual([["From portfolio", 2, true]])
  })

  it("should keep one living expenses node when there is no category mix", () => {
    const flows = buildYearFlows({ expenses: 10_000 }, [])

    expect(flows.uses.map((n) => n.label)).toEqual(["Living expenses"])
  })
})

const expense = (
  categoryName: string,
  monthlyAmount: number,
  expensePhase?: "WORKING" | "RETIREMENT",
): PlanExpense => ({
  id: categoryName,
  planId: "p1",
  categoryLabelId: categoryName.toLowerCase(),
  categoryName,
  monthlyAmount,
  currency: "SGD",
  sortOrder: 0,
  expensePhase,
})

describe("expenseShares", () => {
  it("should weight retirement categories by monthly amount, largest first", () => {
    expect(
      expenseShares([
        expense("Food", 1_000, "RETIREMENT"),
        expense("Housing", 3_000, "RETIREMENT"),
      ]),
    ).toEqual([
      { key: "housing", label: "Housing", share: 0.75 },
      { key: "food", label: "Food", share: 0.25 },
    ])
  })

  it("should leave working-years expenses out, as the engine does", () => {
    expect(
      expenseShares([
        expense("Housing", 2_000, "RETIREMENT"),
        expense("Commuting", 2_000, "WORKING"),
      ]).map((s) => [s.label, s.share]),
    ).toEqual([["Housing", 1]])
  })

  it("should roll the tail into everything else", () => {
    const shares = expenseShares(
      ["A", "B", "C", "D", "E", "F", "G"].map((n, i) =>
        expense(n, 700 - i * 100),
      ),
    )

    expect(shares.map((s) => s.label)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "Everything else",
    ])
    expect(shares.reduce((t, s) => t + s.share, 0)).toBeCloseTo(1)
  })

  it("should return no shares without expenses", () => {
    expect(expenseShares(undefined)).toEqual([])
  })
})

describe("typicalYear", () => {
  it("should average a stage's years, flow by flow", () => {
    const year = typicalYear([
      {
        expenses: 40_000,
        unfundedExpense: 0,
        incomeBreakdown: breakdown({ pension: 10_000, lifeEventExpense: 0 }),
      },
      {
        expenses: 60_000,
        unfundedExpense: 4_000,
        incomeBreakdown: breakdown({
          pension: 20_000,
          lifeEventExpense: 8_000,
        }),
      },
    ])

    const flows = buildYearFlows(year)
    expect(summary(flows.sources)).toEqual([
      ["Pension", 15_000, false],
      ["From portfolio", 37_000, true],
      ["Unfunded shortfall", 2_000, false],
    ])
    expect(summary(flows.uses)).toEqual([
      ["Living expenses", 50_000, false],
      ["Life event expense", 4_000, false],
    ])
  })
})
