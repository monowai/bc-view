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

function mockRouter(query: Record<string, string | string[]> = {}): jest.Mock {
  const push = jest.fn()
  mockUseRouter.mockReturnValue({
    pathname: "/independence",
    query,
    push,
  } as unknown as ReturnType<typeof useRouter>)
  return push
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
    const push = mockRouter({ view: "composite" })

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
})
