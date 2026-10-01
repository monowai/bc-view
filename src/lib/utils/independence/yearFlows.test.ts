import type { IncomeBreakdown } from "types/independence"
import { buildYearFlows, type FlowNode } from "./yearFlows"

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
})
