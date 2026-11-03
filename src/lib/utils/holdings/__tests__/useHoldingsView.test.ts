import { act, renderHook, type RenderHookResult } from "@testing-library/react"
import { useHoldingsView } from "../useHoldingsView"
import { useHoldingState } from "../holdingState"
import { makeAsset, makeCashAsset } from "@test-fixtures/asset"
import { makePortfolio } from "@test-fixtures/portfolio"
import { makePosition } from "@test-fixtures/holdings"
import type { HoldingContract, UserPreferences } from "types/beancounter"

let mockPreferences: { preferences: unknown; isLoading: boolean }

jest.mock("@sentry/nextjs", () => ({
  startSpan: (_opts: unknown, cb: () => unknown) => cb(),
}))
jest.mock("@auth0/nextjs-auth0/client", () => ({ useUser: () => ({}) }))
jest.mock("@contexts/RegistrationContext", () => ({
  useRegistration: () => ({}),
}))
jest.mock("@contexts/UserPreferencesContext", () => ({
  ...jest.requireActual("@contexts/UserPreferencesContext"),
  useUserPreferences: () => mockPreferences,
}))

const buckets = ["PORTFOLIO", "BASE", "TRADE"] as never

function contract(): HoldingContract {
  const portfolio = makePortfolio()
  const small = makePosition({
    asset: makeAsset({ id: "a1", code: "AAA", name: "Alpha" }),
    buckets,
    quantityValues: { total: 10 },
    moneyValues: { marketValue: 1000 },
  })
  const big = makePosition({
    asset: makeAsset({ id: "a2", code: "BBB", name: "Beta" }),
    buckets,
    quantityValues: { total: 5 },
    moneyValues: { marketValue: 9000 },
  })
  const empty = makePosition({
    asset: makeAsset({ id: "a3", code: "CCC", name: "Gamma" }),
    buckets,
    quantityValues: { total: 0 },
    moneyValues: { marketValue: 0 },
  })
  const cash = makePosition({
    asset: makeCashAsset(),
    buckets,
    quantityValues: { total: 500 },
    moneyValues: { marketValue: 500 },
  })
  return {
    portfolio,
    isMixedCurrencies: false,
    asAt: "2026-01-01",
    positions: { small, big, empty, cash },
    totals: {} as HoldingContract["totals"],
  }
}

const prefs = (over: Partial<UserPreferences> = {}): UserPreferences =>
  ({
    defaultHoldingsView: "TABLE",
    defaultValueIn: "TRADE",
    defaultGroupBy: "MARKET",
    ...over,
  }) as UserPreferences

function setup(
  c: HoldingContract | null | undefined = contract(),
): RenderHookResult<
  {
    view: ReturnType<typeof useHoldingsView>
    state: ReturnType<typeof useHoldingState>
  },
  unknown
> {
  return renderHook(() => ({
    view: useHoldingsView(c),
    state: useHoldingState(),
  }))
}

describe("useHoldingsView", () => {
  beforeEach(() => {
    // The holdings state is a module-level singleton: put it back to a clean slate.
    const reset = renderHook(() => useHoldingState())
    act(() => {
      reset.result.current.setHasInitialized(false)
      reset.result.current.setViewMode("summary")
      if (!reset.result.current.hideEmpty)
        reset.result.current.toggleHideEmpty()
    })
    reset.unmount()
    sessionStorage.clear()
    mockPreferences = { preferences: prefs(), isLoading: false }
  })

  it("applies the user's default view, value-in and grouping once preferences load", () => {
    const { result } = setup()
    expect(result.current.view.viewMode).toBe("table")
    expect(result.current.state.valueIn.value).toBe("TRADE")
    expect(result.current.state.hasInitialized).toBe(true)
    expect(result.current.view.allocationGroupBy).toBe("market")
  })

  it("does not overwrite the session's view with preferences after initialising", () => {
    const { result } = setup()
    act(() => result.current.view.setViewMode("cards"))
    expect(result.current.view.viewMode).toBe("cards")
    // re-render with the preferences still present: no reset
    expect(result.current.state.hasInitialized).toBe(true)
  })

  it("returns no holdings without a contract", () => {
    const { result } = setup(null)
    expect(result.current.view.holdings).toBeNull()
    expect(result.current.view.allocationData).toEqual([])
    expect(result.current.view.allocationTotalValue).toBe(0)
  })

  it("groups, hides empty positions and sorts by asset name ascending", () => {
    const { result } = setup()
    const { holdings } = result.current.view
    const groups = Object.values(holdings!.holdingGroups)
    const codes = groups.flatMap((g) => g.positions.map((p) => p.asset.code))
    expect(codes).not.toContain("CCC")
    expect(codes).toContain("AAA")
    for (const g of groups) {
      const sorted = g.positions.map((p) => p.asset.code)
      const nonCash = sorted.filter((c) => c !== "USD")
      expect(nonCash).toEqual([...nonCash].sort())
    }
  })

  it("sorts descending on a first click of a new column and toggles on the next", () => {
    const { result } = setup()
    const order = (): string[] =>
      Object.values(result.current.view.holdings!.holdingGroups).flatMap((g) =>
        g.positions.map((p) => p.asset.code),
      )

    act(() => result.current.view.handleSort("marketValue"))
    expect(result.current.view.sortConfig).toEqual({
      key: "marketValue",
      direction: "desc",
    })
    expect(order().indexOf("BBB")).toBeLessThan(order().indexOf("AAA"))

    act(() => result.current.view.handleSort("marketValue"))
    expect(result.current.view.sortConfig.direction).toBe("asc")
    expect(order().indexOf("AAA")).toBeLessThan(order().indexOf("BBB"))

    act(() => result.current.view.handleSort("marketValue"))
    expect(result.current.view.sortConfig.direction).toBe("desc")
  })

  it("derives allocation slices and their total from the holdings", () => {
    const { result } = setup()
    const { allocationData, allocationTotalValue } = result.current.view
    expect(allocationData.length).toBeGreaterThan(0)
    expect(allocationTotalValue).toBe(
      allocationData.reduce((sum, s) => sum + s.value, 0),
    )
    expect(allocationTotalValue).toBeGreaterThan(0)
  })

  it("toggles category exclusion on and off", () => {
    const { result } = setup()
    expect(result.current.view.excludedCategories.size).toBe(0)
    act(() => result.current.view.handleToggleCategory("Equity"))
    expect(result.current.view.excludedCategories.has("Equity")).toBe(true)
    act(() => result.current.view.handleToggleCategory("Equity"))
    expect(result.current.view.excludedCategories.has("Equity")).toBe(false)
  })

  it("waits for preferences before initialising", () => {
    mockPreferences = { preferences: null, isLoading: true }
    const { result } = setup()
    expect(result.current.state.hasInitialized).toBe(false)
  })

  it("shows empty positions when the user turns hide-empty off", () => {
    const { result } = setup()
    act(() => result.current.state.toggleHideEmpty())
    const codes = Object.values(result.current.view.holdings!.holdingGroups)
      .flatMap((g) => g.positions)
      .map((p) => p.asset.code)
    expect(codes).toContain("CCC")
  })
})
