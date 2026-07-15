import { renderHook, act } from "@testing-library/react"
import { useHoldingState } from "@lib/holdings/holdingState"
import { GROUP_BY_OPTIONS } from "types/constants"

describe("useHoldingState", () => {
  it("defaults grouping to Sector when entering heatmap view without an explicit choice", () => {
    const { result } = renderHook(() => useHoldingState())

    act(() => {
      result.current.setViewMode("heatmap")
    })

    expect(result.current.viewMode).toBe("heatmap")
    expect(result.current.groupBy.value).toBe(GROUP_BY_OPTIONS.SECTOR)
  })

  it("keeps an explicit grouping choice when entering heatmap view", () => {
    const { result } = renderHook(() => useHoldingState())

    act(() => {
      result.current.setGroupBy({
        value: GROUP_BY_OPTIONS.MARKET,
        label: "Market",
      })
      result.current.setViewMode("heatmap")
    })

    expect(result.current.groupBy.value).toBe(GROUP_BY_OPTIONS.MARKET)
  })
})
