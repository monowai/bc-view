import { renderHook } from "@testing-library/react"
import { useSpendLog } from "../useSpendLog"
import type { RetirementPlan } from "types/independence"

let spendRows: unknown[] | undefined
let debitRows: unknown[] | undefined
let accountRows: unknown
let labelRows: unknown[] | undefined
let expenseRows: unknown[] | undefined
let expenseError: Error | undefined
let labelError: Error | undefined
let primaryPlan: Partial<RetirementPlan> | undefined
let planResolved = true
let reportingCurrencyCode: string | undefined = "NZD"

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: unknown) => {
    if (typeof key === "string" && key.includes("/spend")) {
      return {
        data: spendRows && { data: spendRows, debits: debitRows },
        isLoading: spendRows === undefined,
        mutate: jest.fn(),
      }
    }
    if (typeof key === "string" && key.includes("category=ACCOUNT")) {
      return { data: accountRows && { data: accountRows }, isLoading: false }
    }
    if (typeof key === "string" && key.endsWith("/categories")) {
      return {
        data: labelRows && { data: labelRows },
        isLoading: labelRows === undefined && !labelError,
        error: labelError,
      }
    }
    if (typeof key === "string" && key.endsWith("/expenses")) {
      return {
        data: expenseRows && { data: expenseRows },
        isLoading: expenseRows === undefined && !expenseError,
        error: expenseError,
      }
    }
    return { data: undefined, isLoading: false }
  },
}))

jest.mock("@components/features/independence/usePrimaryPlan", () => ({
  usePrimaryPlan: () => ({ primaryPlan, resolved: planResolved }),
}))

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({
    preferences: { reportingCurrencyCode, baseCurrencyCode: "USD" },
  }),
}))

const thisMonth = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

describe("useSpendLog", () => {
  beforeEach(() => {
    spendRows = []
    debitRows = undefined
    accountRows = undefined
    labelRows = [
      { id: "travel", name: "Travel", sortOrder: 2 },
      { id: "housing", name: "Housing", sortOrder: 1 },
    ]
    expenseRows = undefined
    expenseError = undefined
    labelError = undefined
    primaryPlan = undefined
    planResolved = true
    reportingCurrencyCode = "NZD"
  })

  it("offers every expense category in the user's order, with no plan at all", () => {
    const { result } = renderHook(() => useSpendLog())
    expect(result.current.isLoading).toBe(false)
    expect(result.current.categories).toEqual([
      { categoryLabelId: "housing", categoryName: "Housing" },
      { categoryLabelId: "travel", categoryName: "Travel" },
    ])
    expect(result.current.budgets).toEqual({})
    expect(result.current.planCurrency).toBeNull()
  })

  it("records in the user's reporting currency when there is neither a log nor a plan", () => {
    const { result } = renderHook(() => useSpendLog())
    expect(result.current.currency).toBe("NZD")
  })

  it("falls back to the base currency when no reporting currency is set", () => {
    reportingCurrencyCode = undefined
    const { result } = renderHook(() => useSpendLog())
    expect(result.current.currency).toBe("USD")
  })

  it("records in the primary plan's currency before anything is logged", () => {
    primaryPlan = { id: "p1", expensesCurrency: "SGD" }
    expenseRows = []
    const { result } = renderHook(() => useSpendLog())
    expect(result.current.currency).toBe("SGD")
    expect(result.current.planCurrency).toBe("SGD")
  })

  it("keeps the log's own currency once spend is recorded", () => {
    primaryPlan = { id: "p1", expensesCurrency: "SGD" }
    expenseRows = []
    spendRows = [
      {
        month: thisMonth(),
        categoryLabelId: "housing",
        categoryName: "Housing",
        actual: 100,
        currency: "AUD",
      },
    ]
    const { result } = renderHook(() => useSpendLog())
    expect(result.current.currency).toBe("AUD")
  })

  it("takes the budget from the primary plan's retirement expenses", () => {
    primaryPlan = { id: "p1", expensesCurrency: "SGD" }
    expenseRows = [
      {
        categoryLabelId: "housing",
        monthlyAmount: 2_000,
        expensePhase: "RETIREMENT",
      },
      {
        categoryLabelId: "commute",
        monthlyAmount: 400,
        expensePhase: "WORKING",
      },
    ]
    const { result } = renderHook(() => useSpendLog())
    expect(result.current.budgets).toEqual({ housing: 2_000 })
  })

  it("loads two years of history ending this month", () => {
    const { result } = renderHook(() => useSpendLog())
    expect(result.current.historyMonths).toHaveLength(24)
    expect(result.current.historyMonths.at(-1)).toBe(thisMonth())
  })

  it("waits for the plan's budget before it is ready", () => {
    primaryPlan = { id: "p1", expensesCurrency: "SGD" }
    const { result } = renderHook(() => useSpendLog())
    expect(result.current.isLoading).toBe(true)
  })

  it("waits for the primary plan to resolve", () => {
    planResolved = false
    const { result } = renderHook(() => useSpendLog())
    expect(result.current.isLoading).toBe(true)
  })

  it("is ready, flagged, when the plan's budget fails to load", () => {
    primaryPlan = { id: "p1", expensesCurrency: "SGD" }
    expenseError = new Error("HTTP 500")
    const { result } = renderHook(() => useSpendLog())
    expect(result.current.isLoading).toBe(false)
    expect(result.current.budgetsUnavailable).toBe(true)
  })

  it("is ready, flagged, when the categories fail to load", () => {
    labelRows = undefined
    labelError = new Error("HTTP 500")
    const { result } = renderHook(() => useSpendLog())
    expect(result.current.isLoading).toBe(false)
    expect(result.current.categoriesUnavailable).toBe(true)
  })

  it("offers only the private bank accounts in the spend currency", () => {
    reportingCurrencyCode = "SGD"
    accountRows = {
      a: { id: "dbs", name: "DBS Savings", priceSymbol: "SGD" },
      b: { id: "wise", name: "Wise", priceSymbol: "NZD" },
      c: { id: "ocbc", name: "OCBC", priceSymbol: "SGD" },
    }
    const { result } = renderHook(() => useSpendLog())
    expect(result.current.accounts).toEqual([
      { id: "dbs", name: "DBS Savings" },
      { id: "ocbc", name: "OCBC" },
    ])
  })

  it("passes on the withdrawals already posted for the log", () => {
    debitRows = [
      {
        month: "2026-10",
        portfolioId: "p1",
        cashAssetId: "dbs",
        trnId: "t1",
        amount: 100,
        currency: "SGD",
      },
    ]
    const { result } = renderHook(() => useSpendLog())
    expect(result.current.debits).toHaveLength(1)
  })
})
