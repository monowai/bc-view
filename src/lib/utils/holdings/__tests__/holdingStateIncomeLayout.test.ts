import { act, renderHook } from "@testing-library/react"
import { useHoldingState } from "../holdingState"

jest.mock("@components/features/holdings/ValueIn", () => ({
  useValuationOptions: () => ({ valuationDefault: {} }),
}))
jest.mock("@components/features/holdings/GroupByOptions", () => ({
  useGroupOptions: () => ({ groupDefault: {} }),
}))

describe("income layout preference", () => {
  it("defaults to the chart and remembers the choice across the session", () => {
    const { result } = renderHook(() => useHoldingState())
    expect(result.current.incomeLayout).toBe("chart")

    act(() => result.current.setIncomeLayout("calendar"))

    expect(result.current.incomeLayout).toBe("calendar")
    const stored = Object.keys(sessionStorage)
      .map((key) => JSON.parse(sessionStorage.getItem(key) ?? "{}"))
      .find((value) => "incomeLayout" in value)
    expect(stored.incomeLayout).toBe("calendar")
  })
})
