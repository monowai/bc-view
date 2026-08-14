import React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { ModelDto } from "types/rebalance"
import {
  useApprovedModels,
  UseApprovedModelsResult,
} from "../useApprovedModels"

// We don't mock `swr` in this file (real SWR runtime resolves the fetcher),
// so it keeps its normal global cache keyed by `modelsKey` — shared across
// tests in this file by default. Give each render its own fresh cache
// (established pattern — see ScenarioContributions.fetcher.test.tsx /
// OpenBrokerageWizard.test.tsx) so one test's fetch response can't leak
// into the next test's read of the same key.
function renderWithFreshSwrCache(
  enabled: boolean,
): ReturnType<typeof renderHook<UseApprovedModelsResult, unknown>> {
  return renderHook(() => useApprovedModels(enabled), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        SWRConfig,
        { value: { provider: () => new Map(), dedupingInterval: 0 } },
        children,
      ),
  })
}

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

  it("filters to models with a currentPlanId and status APPROVED", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            makeModel({
              id: "approved",
              currentPlanId: "p1",
              currentPlanStatus: "APPROVED",
            }),
            makeModel({ id: "no-plan-at-all" }),
            makeModel({
              id: "draft-status",
              currentPlanId: "p2",
              currentPlanStatus: "DRAFT",
            }),
            makeModel({
              id: "status-without-id",
              currentPlanStatus: "APPROVED",
            }),
          ],
        }),
    })

    const { result } = renderWithFreshSwrCache(true)

    await waitFor(() => {
      expect(result.current.approvedModels.map((m) => m.id)).toEqual([
        "approved",
      ])
    })
    expect(result.current.models).toHaveLength(4)
  })

  it("excludes a model whose currentPlanId points at a DRAFT plan", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            makeModel({
              id: "draft",
              currentPlanId: "p1",
              currentPlanStatus: "DRAFT",
            }),
          ],
        }),
    })

    const { result } = renderWithFreshSwrCache(true)

    await waitFor(() => expect(result.current.models).toHaveLength(1))
    expect(result.current.approvedModels).toEqual([])
  })

  // Backward compatibility: currentPlanStatus is a newer field
  // (svc-rebalance #55). A model from a stale cache/older backend response
  // that predates it carries currentPlanId but no currentPlanStatus at all —
  // treat that as approved rather than hiding the model, since the backend
  // has only ever pointed currentPlanId at an APPROVED plan.
  it("treats a missing currentPlanStatus as approved (backward compatible with a stale cache)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [makeModel({ id: "legacy", currentPlanId: "p1" })],
        }),
    })

    const { result } = renderWithFreshSwrCache(true)

    await waitFor(() => {
      expect(result.current.approvedModels.map((m) => m.id)).toEqual(["legacy"])
    })
  })

  // Strict equality only — no `!== "DRAFT"` catch-all that would silently
  // trust a future/unexpected status this client doesn't know about yet.
  it("does not treat an unexpected status value (e.g. ARCHIVED) as approved", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            makeModel({
              id: "archived",
              currentPlanId: "p1",
              currentPlanStatus:
                "ARCHIVED" as unknown as ModelDto["currentPlanStatus"],
            }),
          ],
        }),
    })

    const { result } = renderWithFreshSwrCache(true)

    await waitFor(() => expect(result.current.models).toHaveLength(1))
    expect(result.current.approvedModels).toEqual([])
  })

  it("does not fetch, and returns empty results, when disabled", () => {
    const { result } = renderWithFreshSwrCache(false)

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.approvedModels).toEqual([])
    expect(result.current.models).toEqual([])
  })
})
