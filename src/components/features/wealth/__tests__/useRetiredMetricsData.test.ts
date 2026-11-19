import { renderHook } from "@testing-library/react"
import { useRetiredMetricsData } from "../useRetiredMetricsData"
import type { RetirementProjection } from "types/independence"

// Net invested per window, keyed by the days parameter in the SWR key.
const invested: Record<string, number> = {}
// Recorded spend and plan expenses, served for their keys when set.
let spendRows: unknown[] | undefined
let expenseRows: unknown[] | undefined
let spendError: Error | undefined

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: unknown) => {
    if (typeof key === "string" && key.includes("/spend")) {
      return {
        data: spendRows && { data: spendRows },
        error: spendError,
        mutate: jest.fn(),
      }
    }
    if (typeof key === "string" && key.endsWith("/expenses")) {
      return { data: expenseRows && { data: expenseRows } }
    }
    if (typeof key === "string") {
      const days = /days=(\d+)/.exec(key)?.[1] ?? ""
      return days in invested
        ? { data: { totalInvested: invested[days] }, isLoading: false }
        : { data: undefined, isLoading: true }
    }
    return { data: undefined, isLoading: true }
  },
}))

const projection = {
  planId: "p1",
  currency: "NZD",
  totalAssets: 1_200_000,
  liquidAssets: 1_000_000,
  monthlyExpenses: 3_000,
  yearlyProjections: [{ year: 2026, withdrawals: 36_000 }],
} as unknown as RetirementProjection

const thisMonth = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

describe("useRetiredMetricsData", () => {
  afterEach(() => {
    for (const k of Object.keys(invested)) delete invested[k]
    spendRows = undefined
    expenseRows = undefined
    spendError = undefined
  })

  it("reports the spend log unavailable when it fails to load", () => {
    spendError = new Error("HTTP 500")
    const { result } = renderHook(() => useRetiredMetricsData(projection))
    expect(result.current.spendUnavailable).toBe(true)
    expect(result.current.spend).toBeNull()
  })

  it("sets recorded spend against the plan's retirement budget", () => {
    expenseRows = [
      {
        categoryLabelId: "housing",
        monthlyAmount: 2_000,
        expensePhase: "RETIREMENT",
      },
      {
        categoryLabelId: "travel",
        monthlyAmount: 1_500,
        expensePhase: "RETIREMENT",
      },
      {
        categoryLabelId: "commute",
        monthlyAmount: 400,
        expensePhase: "WORKING",
      },
    ]
    spendRows = [
      { month: thisMonth(), categoryLabelId: "housing", actual: 2_500 },
      { month: thisMonth(), categoryLabelId: "travel", actual: 1_500 },
    ]
    const { result } = renderHook(() => useRetiredMetricsData(projection))
    expect(result.current.budgets.map((b) => b.categoryLabelId)).toEqual([
      "housing",
      "travel",
    ])
    expect(result.current.spend).toMatchObject({
      monthsEntered: 1,
      actual: 4_000,
      budget: 3_500,
    })
  })

  it("has no spend summary before any spend is recorded", () => {
    spendRows = []
    const { result } = renderHook(() => useRetiredMetricsData(projection))
    expect(result.current.spend).toBeNull()
  })

  it("counts net selling from investments as money drawn", () => {
    invested["30"] = -3_500
    invested["365"] = -44_000
    const { result } = renderHook(() => useRetiredMetricsData(projection))
    expect(result.current.drawnLastMonth).toBe(3_500)
    expect(result.current.drawnLastYear).toBe(44_000)
  })

  it("counts net buying as nothing drawn", () => {
    invested["30"] = 2_000
    invested["365"] = 10_000
    const { result } = renderHook(() => useRetiredMetricsData(projection))
    expect(result.current.drawnLastMonth).toBe(0)
    expect(result.current.drawnLastYear).toBe(0)
  })

  it("leaves the draw unknown until the windows load", () => {
    const { result } = renderHook(() => useRetiredMetricsData(projection))
    expect(result.current.drawnLastYear).toBeUndefined()
    expect(result.current.monteCarloLoading).toBe(true)
  })
})
