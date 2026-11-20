import { renderHook } from "@testing-library/react"
import { usePrimaryPlan } from "../usePrimaryPlan"

let plansData: unknown
let plansError: Error | undefined
let journeysLoading = false

jest.mock("swr", () => ({
  __esModule: true,
  default: () => ({ data: plansData, error: plansError }),
}))

jest.mock("@hooks/useIndependencePlans", () => ({
  useIndependencePlans: () => ({ plans: [], isLoading: journeysLoading }),
}))

describe("usePrimaryPlan", () => {
  beforeEach(() => {
    plansData = undefined
    plansError = undefined
    journeysLoading = false
  })

  it("is not resolved while the plans are loading", () => {
    const { result } = renderHook(() => usePrimaryPlan())
    expect(result.current.resolved).toBe(false)
  })

  it("resolves with the plan the user flagged primary", () => {
    plansData = { data: [{ id: "p1", isPrimary: true }] }
    const { result } = renderHook(() => usePrimaryPlan())
    expect(result.current.resolved).toBe(true)
    expect(result.current.primaryPlan?.id).toBe("p1")
  })

  it("resolves with no plan when the plans fail to load", () => {
    plansError = new Error("HTTP 500")
    const { result } = renderHook(() => usePrimaryPlan())
    expect(result.current.resolved).toBe(true)
    expect(result.current.primaryPlan).toBeUndefined()
  })

  it("waits for the journeys even when the plans have answered", () => {
    plansError = new Error("HTTP 500")
    journeysLoading = true
    const { result } = renderHook(() => usePrimaryPlan())
    expect(result.current.resolved).toBe(false)
  })
})
