import { renderHook, waitFor } from "@testing-library/react"
import { ModelDto } from "types/rebalance"
import { useApprovedModels } from "../useApprovedModels"

function makeModel(overrides: Partial<ModelDto> = {}): ModelDto {
  return {
    id: "m1",
    name: "Model 1",
    baseCurrency: "USD",
    risk: 3,
    shared: false,
    isOwner: true,
    planCount: 1,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    ...overrides,
  }
}

describe("useApprovedModels", () => {
  const mockFetch = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = mockFetch
  })

  it("filters to models with both currentPlanId and currentPlanVersion set (verbatim gate)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            makeModel({
              id: "approved",
              currentPlanId: "p1",
              currentPlanVersion: 2,
            }),
            makeModel({ id: "no-plan-at-all" }),
            makeModel({ id: "id-without-version", currentPlanId: "p2" }),
            makeModel({ id: "version-without-id", currentPlanVersion: 1 }),
          ],
        }),
    })

    const { result } = renderHook(() => useApprovedModels(true))

    await waitFor(() => {
      expect(result.current.approvedModels.map((m) => m.id)).toEqual([
        "approved",
      ])
    })
    expect(result.current.models).toHaveLength(4)
  })

  it("does not fetch, and returns empty results, when disabled", () => {
    const { result } = renderHook(() => useApprovedModels(false))

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.approvedModels).toEqual([])
    expect(result.current.models).toEqual([])
  })
})
