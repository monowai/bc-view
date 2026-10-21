import { renderHook, act } from "@testing-library/react"
import {
  buildInitialPhases,
  useCompositeProjection,
} from "../useCompositeProjection"
import type {
  IndependencePlan,
  RetirementPlan,
  UserIndependenceSettings,
} from "types/independence"

const mockUpdateJourney = jest.fn().mockResolvedValue({})
let mockJourneys: IndependencePlan[] = []
let mockJourneysLoading = false

jest.mock("@hooks/useIndependencePlans", () => ({
  useIndependencePlans: () => ({
    plans: mockJourneys,
    isLoading: mockJourneysLoading,
    error: undefined,
    mutate: jest.fn(),
    create: jest.fn(),
    update: mockUpdateJourney,
    setPrimary: jest.fn(),
    duplicate: jest.fn(),
    remove: jest.fn(),
  }),
}))

function makeJourney(
  overrides: Partial<IndependencePlan> = {},
): IndependencePlan {
  return {
    id: "j1",
    ownerId: "owner-1",
    name: "With Property",
    isPrimary: true,
    createdDate: "2026-01-01",
    updatedDate: "2026-01-01",
    ...overrides,
  }
}

function makePlan(overrides: Partial<RetirementPlan> = {}): RetirementPlan {
  return {
    id: "plan-1",
    ownerId: "owner-1",
    name: "Test Plan",
    planningHorizonYears: 30,
    lifeExpectancy: 90,
    monthlyExpenses: 3000,
    expensesCurrency: "SGD",
    cashReturnRate: 0.02,
    equityReturnRate: 0.07,
    housingReturnRate: 0.03,
    inflationRate: 0.03,
    cashAllocation: 20,
    equityAllocation: 60,
    housingAllocation: 20,
    pensionMonthly: 0,
    socialSecurityMonthly: 0,
    otherIncomeMonthly: 0,
    workingIncomeMonthly: 0,
    workingExpensesMonthly: 0,
    taxesMonthly: 0,
    bonusMonthly: 0,
    investmentAllocationPercent: 80,
    isPrimary: false,
    createdDate: "2025-01-01",
    updatedDate: "2025-01-01",
    ...overrides,
  }
}

describe("buildInitialPhases", () => {
  it("creates a single phase for one plan", () => {
    const plans = [makePlan({ id: "p1" })]
    const phases = buildInitialPhases(plans, new Set(), 60, 90)

    expect(phases).toHaveLength(1)
    expect(phases[0].planId).toBe("p1")
    expect(phases[0].fromAge).toBe(60)
    expect(phases[0].toAge).toBeUndefined()
  })

  it("distributes ages evenly across two plans", () => {
    const plans = [
      makePlan({ id: "p1", name: "Plan A" }),
      makePlan({ id: "p2", name: "Plan B" }),
    ]
    const phases = buildInitialPhases(plans, new Set(), 60, 90)

    expect(phases).toHaveLength(2)
    expect(phases[0].planId).toBe("p1")
    expect(phases[0].fromAge).toBe(60)
    expect(phases[0].toAge).toBe(75)
    expect(phases[1].planId).toBe("p2")
    expect(phases[1].fromAge).toBe(75)
    expect(phases[1].toAge).toBeUndefined()
  })

  it("distributes ages evenly across three plans", () => {
    const plans = [
      makePlan({ id: "p1" }),
      makePlan({ id: "p2" }),
      makePlan({ id: "p3" }),
    ]
    const phases = buildInitialPhases(plans, new Set(), 60, 90)

    expect(phases).toHaveLength(3)
    expect(phases[0].fromAge).toBe(60)
    expect(phases[0].toAge).toBe(70)
    expect(phases[1].fromAge).toBe(70)
    expect(phases[1].toAge).toBe(80)
    expect(phases[2].fromAge).toBe(80)
    expect(phases[2].toAge).toBeUndefined()
  })

  it("excludes plans in excludedPlanIds", () => {
    const plans = [
      makePlan({ id: "p1" }),
      makePlan({ id: "p2" }),
      makePlan({ id: "p3" }),
    ]
    const phases = buildInitialPhases(plans, new Set(["p2"]), 60, 90)

    expect(phases).toHaveLength(2)
    expect(phases.find((p) => p.planId === "p2")).toBeUndefined()
    expect(phases[0].planId).toBe("p1")
    expect(phases[1].planId).toBe("p3")
  })

  it("returns empty array when all plans are excluded", () => {
    const plans = [makePlan({ id: "p1" })]
    const phases = buildInitialPhases(plans, new Set(["p1"]), 60, 90)

    expect(phases).toHaveLength(0)
  })

  it("returns empty array when no plans provided", () => {
    const phases = buildInitialPhases([], new Set(), 60, 90)
    expect(phases).toHaveLength(0)
  })

  it("handles uneven distribution with remainder", () => {
    const plans = [
      makePlan({ id: "p1" }),
      makePlan({ id: "p2" }),
      makePlan({ id: "p3" }),
    ]
    // 31 years / 3 plans = 10 each + 1 remainder
    const phases = buildInitialPhases(plans, new Set(), 59, 90)

    expect(phases).toHaveLength(3)
    // First plan gets the extra year from remainder
    expect(phases[0].fromAge).toBe(59)
    expect(phases[0].toAge).toBe(70)
    expect(phases[1].fromAge).toBe(70)
    expect(phases[1].toAge).toBe(80)
    expect(phases[2].fromAge).toBe(80)
    expect(phases[2].toAge).toBeUndefined()
  })

  it("last phase always has undefined toAge", () => {
    const plans = [makePlan({ id: "p1" }), makePlan({ id: "p2" })]
    const phases = buildInitialPhases(plans, new Set(), 60, 90)

    expect(phases[phases.length - 1].toAge).toBeUndefined()
  })
})

// bc-view #1144: the composite hook must prefer the backend-echoed
// currentAge (CompositeProjectionResult.currentAge, month-of-birth aware,
// resolved server-side from the plan owner's settings) over any
// client-derived value once a projection has landed. The client-side
// derivation remains ONLY as a fallback for first paint, before any
// projection response exists — and even then it must be month-of-birth
// aware (via currentAgeFromSettings), not a naive currentYear - yearOfBirth.
describe("useCompositeProjection — currentAge", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    // Pin "now" to a known date (June 15) so month-of-birth comparisons
    // are deterministic regardless of when the test suite actually runs.
    jest.setSystemTime(new Date(2026, 5, 15))
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("derives currentAge locally (month-of-birth aware) before any projection has landed", () => {
    // Birth month (December, 1-based 12) is AFTER "now" (June) → local
    // derivation must subtract one year. A naive `currentYear -
    // yearOfBirth` would get this wrong (it would report 40, not 39).
    const yearOfBirth = 1986
    const monthOfBirth = 12

    const plans = [makePlan({ id: "p1", isPrimary: true, yearOfBirth })]

    const { result } = renderHook(() =>
      useCompositeProjection(plans, {
        yearOfBirth,
        monthOfBirth,
      } as unknown as import("types/independence").UserIndependenceSettings),
    )

    // 2026 - 1986 = 40, minus 1 since birth month hasn't happened yet.
    expect(result.current.currentAge).toBe(39)
  })

  it("prefers the projection's echoed currentAge once a projection has landed", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { currentAge: 47, yearlyProjections: [], warnings: [] },
        }),
    })

    const plans = [makePlan({ id: "p1", isPrimary: true, yearOfBirth: 1980 })]

    const { result } = renderHook(() =>
      useCompositeProjection(plans, {
        yearOfBirth: 1980,
      } as unknown as import("types/independence").UserIndependenceSettings),
    )

    await act(async () => {
      jest.advanceTimersByTime(600)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.projection?.currentAge).toBe(47)
    expect(result.current.currentAge).toBe(47)
  })

  it("re-runs the same request when asked to refresh", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { currentAge: 47, yearlyProjections: [], warnings: [] },
        }),
    })
    const plans = [makePlan({ id: "p1", isPrimary: true, yearOfBirth: 1980 })]
    const { result } = renderHook(() =>
      useCompositeProjection(plans, {
        yearOfBirth: 1980,
      } as unknown as import("types/independence").UserIndependenceSettings),
    )
    await act(async () => {
      jest.advanceTimersByTime(600)
      await Promise.resolve()
      await Promise.resolve()
    })
    const before = (global.fetch as jest.Mock).mock.calls.length
    expect(before).toBeGreaterThan(0)

    act(() => {
      result.current.refreshProjection()
    })
    await act(async () => {
      jest.advanceTimersByTime(600)
      await Promise.resolve()
      await Promise.resolve()
    })

    // Projection + scenarios: the same pair, fetched again.
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(before * 2)
  })
})

// bc-view #1190: the composite timeline, display currency, exclusions and
// work scenario belong to the independence plan ("journey") being viewed —
// not to the single-row user settings. Demographics stay on /settings.
describe("useCompositeProjection — composite config lives on the journey", () => {
  const plans = [
    makePlan({ id: "p1", name: "Singapore" }),
    makePlan({ id: "p2", name: "Thailand" }),
    makePlan({ id: "p3", name: "New Zealand" }),
  ]

  const journeyPhases = [
    { planId: "p1", fromAge: 61, toAge: 70 },
    { planId: "p2", fromAge: 70 },
  ]

  // Settings deliberately carry a *different* composite: the journey has to
  // win, otherwise the transition shim would keep driving the UI.
  const settings = {
    yearOfBirth: 1970,
    lifeExpectancy: 90,
    compositeDisplayCurrency: "USD",
    compositePhases: JSON.stringify([{ planId: "p3", fromAge: 50 }]),
    compositeExcludedPlanIds: JSON.stringify(["p1"]),
    compositeWorkScenarioId: "ws-from-settings",
  } as unknown as UserIndependenceSettings

  beforeEach(() => {
    jest.useFakeTimers()
    mockUpdateJourney.mockClear()
    mockJourneysLoading = false
    mockJourneys = [
      makeJourney({
        id: "j1",
        displayCurrency: "NZD",
        phases: JSON.stringify(journeyPhases),
        excludedPlanIds: JSON.stringify(["p3"]),
        workScenarioId: "ws-journey",
      }),
      makeJourney({
        id: "j2",
        name: "No Property",
        isPrimary: false,
        displayCurrency: "THB",
        phases: JSON.stringify([{ planId: "p3", fromAge: 61 }]),
        excludedPlanIds: JSON.stringify(["p1", "p2"]),
      }),
    ]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { yearlyProjections: [] } }),
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("seeds the composite from the active journey, not from settings", () => {
    const { result } = renderHook(() =>
      useCompositeProjection(plans, settings, "j1"),
    )

    expect(result.current.phases).toEqual(journeyPhases)
    expect(result.current.displayCurrency).toBe("NZD")
    expect(Array.from(result.current.excludedPlanIds)).toEqual(["p3"])
    expect(result.current.compositeWorkScenarioId).toBe("ws-journey")
  })

  it("saves composite config by PATCHing the journey, never /settings", async () => {
    renderHook(() => useCompositeProjection(plans, settings, "j1"))

    await act(async () => {
      jest.advanceTimersByTime(1100)
      await Promise.resolve()
    })

    expect(mockUpdateJourney).toHaveBeenCalledWith("j1", {
      displayCurrency: "NZD",
      phases: JSON.stringify(journeyPhases),
      excludedPlanIds: JSON.stringify(["p3"]),
      workScenarioId: "ws-journey",
    })
    const fetchedUrls = (global.fetch as jest.Mock).mock.calls.map(
      (call) => call[0],
    )
    expect(fetchedUrls).not.toContain("/api/independence/settings")
  })

  it("writes nothing when there is no journey to write to", async () => {
    mockJourneys = []
    const { result } = renderHook(() =>
      useCompositeProjection(plans, settings, undefined),
    )

    await act(async () => {
      jest.advanceTimersByTime(1100)
      await Promise.resolve()
    })

    // Composite still works in-session, it just has nowhere to persist.
    expect(result.current.phases.length).toBeGreaterThan(0)
    expect(mockUpdateJourney).not.toHaveBeenCalled()
  })

  it("re-seeds when the user switches journey rather than saving the old timeline over the new one", async () => {
    const { result, rerender } = renderHook(
      ({ activeId }: { activeId: string }) =>
        useCompositeProjection(plans, settings, activeId),
      { initialProps: { activeId: "j1" } },
    )
    expect(result.current.phases).toEqual(journeyPhases)

    rerender({ activeId: "j2" })
    expect(result.current.phases).toEqual([{ planId: "p3", fromAge: 61 }])
    expect(result.current.displayCurrency).toBe("THB")
    expect(Array.from(result.current.excludedPlanIds)).toEqual(["p1", "p2"])
    // j2 carries no work scenario — it must clear, not inherit j1's.
    expect(result.current.compositeWorkScenarioId).toBeUndefined()

    await act(async () => {
      jest.advanceTimersByTime(1100)
      await Promise.resolve()
    })

    expect(mockUpdateJourney).toHaveBeenCalledTimes(1)
    expect(mockUpdateJourney).toHaveBeenCalledWith("j2", {
      displayCurrency: "THB",
      phases: JSON.stringify([{ planId: "p3", fromAge: 61 }]),
      excludedPlanIds: JSON.stringify(["p1", "p2"]),
      workScenarioId: undefined,
    })
  })
})
