import { renderHook, waitFor } from "@testing-library/react"
import { PlanDto } from "types/rebalance"
import { useModelPlan } from "../useModelPlan"

const makePlan = (): PlanDto => ({
  id: "plan-1",
  modelId: "model-1",
  modelName: "Model 1",
  version: 1,
  status: "DRAFT",
  assets: [],
  cashWeight: 1,
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
})

describe("useModelPlan", () => {
  const mockFetch = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = mockFetch
  })

  it("fetches the plan via the model+plan proxy when both ids are present", async () => {
    const plan = makePlan()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: plan }),
    })

    const { result } = renderHook(() => useModelPlan("model-1", "plan-1"))

    await waitFor(() => {
      expect(result.current.plan).toEqual(plan)
    })
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/rebalance/models/model-1/plans/plan-1",
    )
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeUndefined()
  })

  it("does not fetch when modelId is missing", () => {
    const { result } = renderHook(() => useModelPlan(undefined, "plan-1"))

    expect(result.current.plan).toBeUndefined()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("does not fetch when planId is missing", () => {
    const { result } = renderHook(() => useModelPlan("model-1", undefined))

    expect(result.current.plan).toBeUndefined()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("exposes a mutate function for callers to trigger a revalidation", () => {
    const { result } = renderHook(() => useModelPlan("model-1", "plan-1"))

    expect(typeof result.current.mutate).toBe("function")
  })
})
