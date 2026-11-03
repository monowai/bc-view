import { act, renderHook } from "@testing-library/react"
import { BC_STORAGE_PREFIX } from "../../storage/sessionState"
import {
  initialHoldingState,
  loadPersistedState,
  useHoldingState,
} from "../holdingState"

const STORAGE_KEY = `${BC_STORAGE_PREFIX}wealth`

function stored(): Record<string, unknown> {
  return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}")
}

beforeEach(() => sessionStorage.clear())

describe("initial holdings state", () => {
  it("starts with sensible defaults", () => {
    expect(initialHoldingState(null)).toEqual({
      hideEmpty: true,
      asAt: "today",
      hasInitialized: false,
      viewMode: "summary",
      valueIn: null,
      groupBy: null,
      displayCurrency: null,
      incomePeriod: 12,
      incomeLayout: "chart",
    })
  })

  it("restores the session's choices on load", () => {
    const persisted = {
      hideEmpty: false,
      asAt: "2024-05-01",
      hasInitialized: true,
      viewMode: "table",
      incomePeriod: 6,
      incomeLayout: "calendar",
      displayCurrency: { mode: "CUSTOM", code: "NZD" },
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))

    expect(initialHoldingState(loadPersistedState())).toMatchObject(persisted)
  })

  it("falls back to the default for a null setting and drops unknown keys", () => {
    const state = initialHoldingState({
      viewMode: null,
      incomePeriod: 3,
      somethingElse: "x",
    })
    expect(state.viewMode).toBe("summary")
    expect(state.incomePeriod).toBe(3)
    expect(state).not.toHaveProperty("somethingElse")
  })

  it("ignores unreadable persisted state", () => {
    sessionStorage.setItem(STORAGE_KEY, "{not json")
    expect(loadPersistedState()).toBeNull()
    expect(initialHoldingState(loadPersistedState()).viewMode).toBe("summary")
  })
})

describe("useHoldingState", () => {
  it("persists every change to the session", () => {
    const { result } = renderHook(() => useHoldingState())

    act(() => result.current.toggleHideEmpty())
    expect(result.current.hideEmpty).toBe(false)
    expect(stored().hideEmpty).toBe(false)

    act(() => result.current.setAsAt("2023-12-31"))
    expect(result.current.asAt).toBe("2023-12-31")
    expect(stored().asAt).toBe("2023-12-31")

    act(() => result.current.setViewMode("cards"))
    expect(stored().viewMode).toBe("cards")

    act(() => result.current.setHasInitialized(true))
    expect(result.current.hasInitialized).toBe(true)

    act(() => result.current.setIncomePeriod(3))
    expect(result.current.incomePeriod).toBe(3)

    act(() =>
      result.current.setGroupBy({
        value: "asset.market.code",
        label: "Market",
      } as never),
    )
    expect(result.current.groupBy.value).toBe("asset.market.code")
    expect((stored().groupBy as { value: string }).value).toBe(
      "asset.market.code",
    )
  })

  it("resets the display currency to match Value In when Value In changes", () => {
    const { result } = renderHook(() => useHoldingState())

    act(() =>
      result.current.setDisplayCurrency({
        mode: "CUSTOM",
        code: "EUR",
      } as never),
    )
    expect(result.current.isCostApproximate).toBe(true)

    act(() =>
      result.current.setValueIn({ value: "TRADE", label: "Trade" } as never),
    )
    expect(result.current.valueIn.value).toBe("TRADE")
    expect(result.current.displayCurrency).toEqual({ mode: "TRADE" })
    expect(result.current.isCostApproximate).toBe(false)
  })

  it("follows changes made in another tab", () => {
    const { result } = renderHook(() => useHoldingState())

    const fire = (value: unknown, key = STORAGE_KEY): void => {
      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key,
            newValue: typeof value === "string" ? value : JSON.stringify(value),
          }),
        )
      })
    }

    fire({
      hideEmpty: false,
      asAt: "2022-02-02",
      hasInitialized: true,
      viewMode: "heatmap",
      valueIn: { value: "BASE", label: "Base" },
      groupBy: { value: "asset.market.code", label: "Market" },
      displayCurrency: { mode: "BASE" },
      incomePeriod: 24,
      incomeLayout: "calendar",
    })
    expect(result.current.hideEmpty).toBe(false)
    expect(result.current.asAt).toBe("2022-02-02")
    expect(result.current.hasInitialized).toBe(true)
    expect(result.current.viewMode).toBe("heatmap")
    expect(result.current.valueIn.value).toBe("BASE")
    expect(result.current.groupBy.value).toBe("asset.market.code")
    expect(result.current.displayCurrency).toEqual({ mode: "BASE" })
    expect(result.current.incomePeriod).toBe(24)
    expect(result.current.incomeLayout).toBe("calendar")

    // null option values and unrelated keys / bad JSON leave state alone
    fire({ valueIn: null, groupBy: null, displayCurrency: null })
    expect(result.current.valueIn.value).toBe("BASE")
    fire({ viewMode: "table" }, "some-other-key")
    expect(result.current.viewMode).toBe("heatmap")
    fire("{broken")
    expect(result.current.viewMode).toBe("heatmap")
  })

  it("stops listening after unmount", () => {
    const { result, unmount } = renderHook(() => useHoldingState())
    act(() => result.current.setViewMode("summary"))
    unmount()
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEY,
          newValue: JSON.stringify({ viewMode: "table" }),
        }),
      )
    })
    expect(result.current.viewMode).toBe("summary")
  })
})
