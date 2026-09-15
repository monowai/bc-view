import { renderHook, act } from "@testing-library/react"
import useSwr from "swr"
import { useRouter } from "next/router"
import {
  useActiveIndependencePlan,
  useIndependencePlans,
} from "../useIndependencePlans"
import type { IndependencePlan } from "types/independence"

jest.mock("swr")
jest.mock("next/router", () => ({ useRouter: jest.fn() }))

const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

function makeJourney(
  overrides: Partial<IndependencePlan> = {},
): IndependencePlan {
  return {
    id: "j1",
    ownerId: "owner-1",
    name: "With Property",
    isPrimary: false,
    createdDate: "2026-01-01",
    updatedDate: "2026-01-01",
    ...overrides,
  }
}

function mockJourneys(journeys: IndependencePlan[]): jest.Mock {
  const mutate = jest.fn()
  mockUseSwr.mockReturnValue({
    data: { data: journeys },
    mutate,
    error: undefined,
    isLoading: false,
    isValidating: false,
  } as unknown as ReturnType<typeof useSwr>)
  return mutate
}

function mockRouter(query: Record<string, string | string[]> = {}): {
  push: jest.Mock
  replace: jest.Mock
} {
  const push = jest.fn()
  const replace = jest.fn()
  mockUseRouter.mockReturnValue({
    pathname: "/independence",
    query,
    push,
    replace,
  } as unknown as ReturnType<typeof useRouter>)
  return { push, replace }
}

describe("useActiveIndependencePlan — resolution order", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
    mockUseRouter.mockReset()
    global.fetch = jest.fn()
  })

  afterEach(() => jest.restoreAllMocks())

  it("prefers ?plan when it names a journey the user owns", () => {
    mockJourneys([
      makeJourney({ id: "j1", name: "With Property", isPrimary: true }),
      makeJourney({ id: "j2", name: "No Property" }),
    ])
    mockRouter({ plan: "j2" })

    const { result } = renderHook(() => useActiveIndependencePlan())

    expect(result.current.activePlanId).toBe("j2")
  })

  it("falls back to the default journey when ?plan names one the user doesn't own", () => {
    mockJourneys([
      makeJourney({ id: "j1", name: "With Property" }),
      makeJourney({ id: "j2", name: "No Property", isPrimary: true }),
    ])
    mockRouter({ plan: "someone-elses-journey" })

    const { result } = renderHook(() => useActiveIndependencePlan())

    expect(result.current.activePlanId).toBe("j2")
  })

  it("uses the default journey when there is no ?plan", () => {
    mockJourneys([
      makeJourney({ id: "j1", name: "With Property" }),
      makeJourney({ id: "j2", name: "No Property", isPrimary: true }),
    ])
    mockRouter()

    const { result } = renderHook(() => useActiveIndependencePlan())

    expect(result.current.activePlanId).toBe("j2")
  })

  it("falls back to the first journey by name when none is the default", () => {
    // Deliberately not in name order — resolution sorts, it doesn't take [0].
    mockJourneys([
      makeJourney({ id: "j1", name: "Zurich" }),
      makeJourney({ id: "j2", name: "Auckland" }),
    ])
    mockRouter()

    const { result } = renderHook(() => useActiveIndependencePlan())

    expect(result.current.activePlanId).toBe("j2")
  })

  it("resolves to none when the user owns no journeys", () => {
    mockJourneys([])
    mockRouter({ plan: "j1" })

    const { result } = renderHook(() => useActiveIndependencePlan())

    expect(result.current.activePlan).toBeUndefined()
    expect(result.current.activePlanId).toBeUndefined()
  })

  it("switches journey with a shallow route update, not a navigation", () => {
    mockJourneys([
      makeJourney({ id: "j1", name: "With Property", isPrimary: true }),
      makeJourney({ id: "j2", name: "No Property" }),
    ])
    const { push } = mockRouter({ view: "composite" })

    const { result } = renderHook(() => useActiveIndependencePlan())
    act(() => result.current.setActivePlan("j2"))

    expect(push).toHaveBeenCalledWith(
      {
        pathname: "/independence",
        query: { view: "composite", plan: "j2" },
      },
      undefined,
      { shallow: true },
    )
  })
})

describe("useActiveIndependencePlan — a ?plan that no longer resolves", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
    mockUseRouter.mockReset()
    global.fetch = jest.fn()
  })

  afterEach(() => jest.restoreAllMocks())

  it("rewrites the URL to the journey actually being shown", () => {
    // Deleting a journey in another tab leaves this one pointing at a dead
    // id. Resolution falls back silently, so without this the URL and the
    // switcher disagree and a reload repeats the whole thing.
    mockJourneys([
      makeJourney({ id: "j1", name: "With Property" }),
      makeJourney({ id: "j2", name: "No Property", isPrimary: true }),
    ])
    const { replace } = mockRouter({ view: "composite", plan: "deleted" })

    renderHook(() => useActiveIndependencePlan())

    expect(replace).toHaveBeenCalledWith(
      {
        pathname: "/independence",
        query: { view: "composite", plan: "j2" },
      },
      undefined,
      { shallow: true },
    )
  })

  it("drops the parameter entirely when nothing resolves", () => {
    mockJourneys([])
    const { replace } = mockRouter({ view: "phases", plan: "deleted" })

    renderHook(() => useActiveIndependencePlan())

    expect(replace).toHaveBeenCalledWith(
      { pathname: "/independence", query: { view: "phases" } },
      undefined,
      { shallow: true },
    )
  })

  it("leaves a ?plan that does resolve alone", () => {
    mockJourneys([
      makeJourney({ id: "j1", name: "With Property", isPrimary: true }),
      makeJourney({ id: "j2", name: "No Property" }),
    ])
    const { replace } = mockRouter({ plan: "j2" })

    renderHook(() => useActiveIndependencePlan())

    expect(replace).not.toHaveBeenCalled()
  })

  it("leaves the URL alone when there is no ?plan at all", () => {
    mockJourneys([makeJourney({ id: "j1", isPrimary: true })])
    const { replace } = mockRouter({ view: "phases" })

    renderHook(() => useActiveIndependencePlan())

    expect(replace).not.toHaveBeenCalled()
  })

  it("waits for the journeys to load rather than clearing on an empty cache", () => {
    // "Not fetched yet" is not "not owned" — correcting here would strip a
    // perfectly good ?plan off a cold load.
    mockUseSwr.mockReturnValue({
      data: undefined,
      mutate: jest.fn(),
      error: undefined,
      isLoading: true,
      isValidating: true,
    } as unknown as ReturnType<typeof useSwr>)
    const { replace } = mockRouter({ plan: "j2" })

    renderHook(() => useActiveIndependencePlan())

    expect(replace).not.toHaveBeenCalled()
  })

  it("corrects once, not on every render", () => {
    mockJourneys([makeJourney({ id: "j1", isPrimary: true })])
    const { replace } = mockRouter({ plan: "deleted" })

    const { rerender } = renderHook(() => useActiveIndependencePlan())
    rerender()
    rerender()

    expect(replace).toHaveBeenCalledTimes(1)
  })
})

describe("useIndependencePlans — mutators", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
    mockUseRouter.mockReset()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: makeJourney({ id: "new" }) }),
    })
  })

  afterEach(() => jest.restoreAllMocks())

  const key = "/api/independence/independence-plans"

  it("create POSTs to the journeys endpoint and revalidates", async () => {
    const mutate = mockJourneys([])
    const { result } = renderHook(() => useIndependencePlans())

    let created: IndependencePlan | undefined
    await act(async () => {
      created = await result.current.create({ name: "No Property" })
    })

    expect(global.fetch).toHaveBeenCalledWith(
      key,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "No Property" }),
      }),
    )
    expect(created?.id).toBe("new")
    expect(mutate).toHaveBeenCalled()
  })

  it("update PATCHes the journey and revalidates", async () => {
    const mutate = mockJourneys([makeJourney()])
    const { result } = renderHook(() => useIndependencePlans())

    await act(async () => {
      await result.current.update("j1", { displayCurrency: "SGD" })
    })

    expect(global.fetch).toHaveBeenCalledWith(
      `${key}/j1`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ displayCurrency: "SGD" }),
      }),
    )
    expect(mutate).toHaveBeenCalled()
  })

  it("setPrimary POSTs to /primary and revalidates", async () => {
    const mutate = mockJourneys([makeJourney()])
    const { result } = renderHook(() => useIndependencePlans())

    await act(async () => {
      await result.current.setPrimary("j1")
    })

    expect(global.fetch).toHaveBeenCalledWith(`${key}/j1/primary`, {
      method: "POST",
    })
    expect(mutate).toHaveBeenCalled()
  })

  it("duplicate POSTs the new name to /duplicate and revalidates", async () => {
    const mutate = mockJourneys([makeJourney()])
    const { result } = renderHook(() => useIndependencePlans())

    await act(async () => {
      await result.current.duplicate("j1", { name: "No Property" })
    })

    expect(global.fetch).toHaveBeenCalledWith(
      `${key}/j1/duplicate`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "No Property" }),
      }),
    )
    expect(mutate).toHaveBeenCalled()
  })

  it("remove DELETEs the journey and revalidates", async () => {
    const mutate = mockJourneys([makeJourney()])
    const { result } = renderHook(() => useIndependencePlans())

    await act(async () => {
      await result.current.remove("j1")
    })

    expect(global.fetch).toHaveBeenCalledWith(`${key}/j1`, {
      method: "DELETE",
    })
    expect(mutate).toHaveBeenCalled()
  })

  it("surfaces a failed update as an error", async () => {
    mockJourneys([makeJourney()])
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    })
    const { result } = renderHook(() => useIndependencePlans())

    await expect(result.current.update("j1", { name: "boom" })).rejects.toThrow(
      "Failed to update plan",
    )
  })

  // Every mutator reads the backend's reason, not just the ones returning a
  // body. "Failed to delete plan" tells the user nothing they can act on.
  describe("surfacing the backend's reason", () => {
    function rejectWith(body: Record<string, string>): void {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve(body),
      })
    }

    it("update prefers `message`", async () => {
      mockJourneys([makeJourney()])
      rejectWith({ message: "liquidationCostsPercent must be under 1" })
      const { result } = renderHook(() => useIndependencePlans())

      await expect(
        result.current.update("j1", { liquidationCostsPercent: 2 }),
      ).rejects.toThrow("liquidationCostsPercent must be under 1")
    })

    it("setPrimary surfaces the reason rather than a generic message", async () => {
      mockJourneys([makeJourney()])
      rejectWith({ message: "Plan is shared and cannot be the default" })
      const { result } = renderHook(() => useIndependencePlans())

      await expect(result.current.setPrimary("j1")).rejects.toThrow(
        "Plan is shared and cannot be the default",
      )
    })

    it("remove surfaces the reason rather than a generic message", async () => {
      mockJourneys([makeJourney()])
      rejectWith({ message: "Plan still has 3 phases" })
      const { result } = renderHook(() => useIndependencePlans())

      await expect(result.current.remove("j1")).rejects.toThrow(
        "Plan still has 3 phases",
      )
    })

    it("falls back to `error` when there is no `message`", async () => {
      mockJourneys([makeJourney()])
      rejectWith({ error: "Forbidden" })
      const { result } = renderHook(() => useIndependencePlans())

      await expect(result.current.remove("j1")).rejects.toThrow("Forbidden")
    })

    it("falls back to the generic message on an unreadable body", async () => {
      mockJourneys([makeJourney()])
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("not JSON")),
      })
      const { result } = renderHook(() => useIndependencePlans())

      await expect(result.current.setPrimary("j1")).rejects.toThrow(
        "Failed to set default plan",
      )
    })
  })
})
