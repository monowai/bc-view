import { renderHook, waitFor } from "@testing-library/react"
import { ModelDto, PlanDto } from "types/rebalance"

const mockUseModels: {
  models: ModelDto[]
  isLoading: boolean
  error: Error | undefined
} = {
  models: [],
  isLoading: false,
  error: undefined,
}
jest.mock("../useModels", () => ({
  useModels: () => mockUseModels,
}))

import { useAllPlans } from "../useAllPlans"

const makeModel = (id: string): ModelDto => ({
  id,
  name: `Model ${id}`,
  baseCurrency: "USD",
  risk: 3,
  shared: false,
  isOwner: true,
  planCount: 1,
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
})

const makePlan = (id: string, modelId: string): PlanDto => ({
  id,
  modelId,
  modelName: `Model ${modelId}`,
  version: 1,
  status: "DRAFT",
  assets: [],
  cashWeight: 1,
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
})

describe("useAllPlans", () => {
  const mockFetch = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = mockFetch
    mockUseModels.models = []
    mockUseModels.isLoading = false
    mockUseModels.error = undefined
  })

  it("fans out one request per model via the working per-model proxy and merges results", async () => {
    mockUseModels.models = [makeModel("m1"), makeModel("m2")]
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/rebalance/models/m1/plans") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [makePlan("p1", "m1")] }),
        })
      }
      if (url === "/api/rebalance/models/m2/plans") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [makePlan("p2", "m2")] }),
        })
      }
      throw new Error(`unexpected url ${url}`)
    })

    const { result } = renderHook(() => useAllPlans())

    await waitFor(() => {
      expect(result.current.plans.map((p) => p.id).sort()).toEqual(["p1", "p2"])
    })
    expect(mockFetch).not.toHaveBeenCalledWith(
      "/api/rebalance/plans",
      expect.anything(),
    )
  })

  it("returns an empty list without fetching when there are no models", async () => {
    mockUseModels.models = []

    const { result } = renderHook(() => useAllPlans())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.plans).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("stays loading while the model list itself is loading", () => {
    mockUseModels.isLoading = true

    const { result } = renderHook(() => useAllPlans())

    expect(result.current.isLoading).toBe(true)
  })

  it("surfaces a model-list error", () => {
    const error = new Error("models down")
    mockUseModels.error = error

    const { result } = renderHook(() => useAllPlans())

    expect(result.current.error).toBe(error)
  })
})
