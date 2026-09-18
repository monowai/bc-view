import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSwr from "swr"
import type { IndependencePlan, RetirementPlan } from "types/independence"

// ── SWR keyed by url ────────────────────────────────────────────────────────

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))

// ── Router: the page reads `?view=` on mount ────────────────────────────────

let mockQuery: Record<string, string> = {}

jest.mock("next/router", () => ({
  useRouter: () => ({
    query: mockQuery,
    pathname: "/independence",
    push: jest.fn(),
    replace: jest.fn(),
    events: { on: jest.fn(), off: jest.fn() },
  }),
}))

// ── The plan (journey) being viewed ─────────────────────────────────────────

const mockMutateJourneys = jest.fn().mockResolvedValue(undefined)
let mockActiveJourney: IndependencePlan | undefined

jest.mock("@hooks/useIndependencePlans", () => ({
  useActiveIndependencePlan: () => ({
    plans: mockActiveJourney ? [mockActiveJourney] : [],
    activePlan: mockActiveJourney,
    activePlanId: mockActiveJourney?.id,
    setActivePlan: jest.fn(),
    mutate: mockMutateJourneys,
    isLoading: false,
  }),
}))

jest.mock("@hooks/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({
    settings: {
      yearOfBirth: 1970,
      monthOfBirth: 6,
      targetIndependenceAge: 60,
      lifeExpectancy: 90,
    },
    mutateSettings: jest.fn().mockResolvedValue(undefined),
  }),
}))

// ── Stubs for the surfaces this suite doesn't exercise ──────────────────────

jest.mock("@components/features/independence", () => ({
  useAssetBreakdown: () => ({}),
  useFiProjectionSimple: () => ({ projection: undefined, isLoading: false }),
}))

// Records the props the Plan tab is handed — which plans it is given is the
// whole question in "the Plan tab is scoped to the active plan" below.
const mockCompositeTab = jest.fn()

jest.mock("@components/features/independence/CompositeTab", () => ({
  __esModule: true,
  default: (props: { plans: RetirementPlan[] }) => {
    mockCompositeTab(props)
    return <div data-testid="composite-tab" />
  },
}))
jest.mock("@components/features/independence/IndependencePlanSwitcher", () => ({
  __esModule: true,
  default: () => <div data-testid="plan-switcher" />,
}))
jest.mock("@components/features/independence/scenarios/ScenarioList", () => ({
  __esModule: true,
  default: () => <div data-testid="scenario-list" />,
}))
jest.mock(
  "@components/features/independence/IndependenceSettingsPanel",
  () => ({
    __esModule: true,
    default: () => <div data-testid="settings-panel" />,
  }),
)
jest.mock("@components/features/shares/ResourceShareInviteDialog", () => ({
  __esModule: true,
  default: () => <div data-testid="share-dialog" />,
}))
jest.mock("@components/features/shares/PendingResourceSharesPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="pending-shares" />,
}))

import IndependencePage from "@pages/independence/index"

const Page = IndependencePage as React.ComponentType<Record<string, unknown>>

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeJourney(
  overrides: Partial<IndependencePlan> & { id: string },
): IndependencePlan {
  return {
    ownerId: "owner-1",
    name: "With Property",
    isPrimary: true,
    createdDate: "2026-01-01",
    updatedDate: "2026-01-01",
    ...overrides,
  }
}

function makePhasePlan(
  overrides: Partial<RetirementPlan> & { id: string; name: string },
): RetirementPlan {
  return {
    ownerId: "owner-1",
    planningHorizonYears: 30,
    lifeExpectancy: 90,
    monthlyExpenses: 4000,
    expensesCurrency: "USD",
    cashReturnRate: 0.02,
    equityReturnRate: 0.07,
    housingReturnRate: 0.03,
    inflationRate: 0.02,
    cashAllocation: 10,
    equityAllocation: 80,
    housingAllocation: 10,
    pensionMonthly: 0,
    socialSecurityMonthly: 0,
    otherIncomeMonthly: 0,
    workingIncomeMonthly: 0,
    workingExpensesMonthly: 0,
    taxesMonthly: 0,
    bonusMonthly: 0,
    investmentAllocationPercent: 0,
    isPrimary: false,
    createdDate: "2026-01-01",
    updatedDate: "2026-01-01",
    ...overrides,
  } as RetirementPlan
}

const mockFetch = jest.fn()

function mockSwr(phasePlans: RetirementPlan[]): void {
  ;(useSwr as jest.Mock).mockImplementation((key: string | null) => {
    if (key === "/api/independence/plans") {
      return {
        data: { data: phasePlans },
        error: null,
        isLoading: false,
        mutate: jest.fn(),
      }
    }
    if (typeof key === "string" && key.includes("work-scenarios")) {
      return {
        data: { data: [{ id: "ws-1" }] },
        error: null,
        mutate: jest.fn(),
      }
    }
    return { data: undefined, error: null, isLoading: false, mutate: jest.fn() }
  })
}

/** The active plan's own phase row, plus two belonging to another plan. */
const ownedPhase = makePhasePlan({
  id: "plan-owning",
  name: "Owning Base",
  independencePlanId: "jrn-owning",
  isPrimary: true,
})
const otherPhases = [
  makePhasePlan({
    id: "plan-rent-go",
    name: "Renting Go-Go",
    independencePlanId: "jrn-renting",
  }),
  makePhasePlan({
    id: "plan-rent-slow",
    name: "Renting Slow-Go",
    independencePlanId: "jrn-renting",
  }),
]

const OFFER = /generate phased plans/i

describe("/independence — phasing offer follows the active plan", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockQuery = { view: "phases" }
    global.fetch = mockFetch
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("") })
  })

  it("offers phasing for an unphased plan even when other plans are phased", () => {
    // Three owned phase plans in total — the old `ownedPlans.length !== 1`
    // gate would have withheld the offer forever once a second plan existed.
    mockActiveJourney = makeJourney({ id: "jrn-owning" })
    mockSwr([...otherPhases, ownedPhase])

    render(<Page />)

    expect(screen.getByRole("button", { name: OFFER })).toBeInTheDocument()
  })

  it("withholds the offer once the active plan carries phases", () => {
    mockActiveJourney = makeJourney({
      id: "jrn-owning",
      phases: JSON.stringify([{ planId: "plan-owning", fromAge: 60 }]),
    })
    mockSwr([ownedPhase])

    render(<Page />)

    expect(
      screen.queryByRole("button", { name: OFFER }),
    ).not.toBeInTheDocument()
  })

  it("still offers phasing for a legacy row that names no plan", () => {
    // Rows created before `independencePlanId` existed carry no link. A lone
    // one is unambiguous, so the single-plan user keeps the offer they had.
    mockActiveJourney = makeJourney({ id: "jrn-owning" })
    mockSwr([makePhasePlan({ id: "plan-legacy", name: "Legacy Plan" })])

    render(<Page />)

    expect(screen.getByRole("button", { name: OFFER })).toBeInTheDocument()
  })

  it("withholds the offer when no phase plan belongs to the active plan", () => {
    mockActiveJourney = makeJourney({ id: "jrn-empty" })
    mockSwr(otherPhases)

    render(<Page />)

    expect(
      screen.queryByRole("button", { name: OFFER }),
    ).not.toBeInTheDocument()
  })

  it("still offers phasing to a legacy user who has no plan at all", () => {
    // Before journeys existed, rows carried no `independencePlanId` and there
    // was no journey row either. Such a user sees their ungrouped rows on the
    // Phases tab, so the offer has to come from those — sourcing it from the
    // (empty) active journey withheld an affordance they already had.
    mockActiveJourney = undefined
    mockSwr([
      makePhasePlan({ id: "plan-legacy-a", name: "Legacy A" }),
      makePhasePlan({ id: "plan-legacy-b", name: "Legacy B", isPrimary: true }),
    ])

    render(<Page />)

    expect(screen.getByRole("button", { name: OFFER })).toBeInTheDocument()
  })

  it("posts the active plan's id and never forces", async () => {
    mockActiveJourney = makeJourney({ id: "jrn-owning" })
    mockSwr([...otherPhases, ownedPhase])

    render(<Page />)
    fireEvent.click(screen.getByRole("button", { name: OFFER }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("/api/independence/plans/plan-owning/phases")
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({ independencePlanId: "jrn-owning" })
    // Forcing would overwrite whatever composite the plan already holds —
    // the backend refuses per plan now, so the offer never needs it.
    expect(body).not.toHaveProperty("force")

    // The phases land on the journey, which is what gates the Plan tab.
    await waitFor(() => expect(mockMutateJourneys).toHaveBeenCalled())
  })
})

describe("/independence — the Plan tab follows the active plan's phases", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockQuery = { view: "plan" }
    global.fetch = mockFetch
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("") })
  })

  it.each([
    ["phases", "Stages"],
    ["plans", "Stages"],
    ["profile", "About you"],
    ["work", "Working years"],
    ["wealth", "What counts as wealth"],
  ])(
    "follows ?view=%s into Set up, so old links keep working",
    (view, section) => {
      // The destination is derived from the URL, not held in state. Held in
      // state, a query-only navigation changed the address bar and nothing
      // else — which made the "Set up your stages" button on an empty plan a
      // link that visibly did nothing.
      mockQuery = { view }
      mockActiveJourney = makeJourney({
        id: "jrn-owning",
        phases: JSON.stringify([{ planId: "plan-owning", fromAge: 60 }]),
      })
      mockSwr([ownedPhase])

      render(<Page />)

      expect(screen.getByRole("button", { name: /Set up/ })).toHaveAttribute(
        "aria-current",
        "page",
      )
      expect(
        screen.getByRole("button", { name: new RegExp(section) }),
      ).toHaveAttribute("aria-current", "page")
    },
  )

  it("shows the composite for a phased plan holding a single phase row", () => {
    mockActiveJourney = makeJourney({
      id: "jrn-owning",
      phases: JSON.stringify([{ planId: "plan-owning", fromAge: 60 }]),
    })
    mockSwr([ownedPhase])

    render(<Page />)

    expect(
      screen.getByRole("button", { name: /Your plan/ }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("composite-tab")).toBeInTheDocument()
  })

  it("hides the composite for an unphased plan however many rows the user owns", () => {
    // Three owned phase plans — a `plans.length > 1` gate would show the tab
    // here, sourced from another plan's composite.
    mockActiveJourney = makeJourney({ id: "jrn-owning" })
    mockSwr([...otherPhases, ownedPhase])

    render(<Page />)

    expect(
      screen.queryByRole("button", { name: /Your plan/ }),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId("composite-tab")).not.toBeInTheDocument()
    // Falls back to Set up — where stages get made — rather than offering
    // a reading surface with nothing to read.
    expect(screen.getByRole("button", { name: OFFER })).toBeInTheDocument()
  })

  it("lists only the active plan's phases, not every owned row", () => {
    // After duplicating a plan, both plans' phases carry the same names.
    // Listing every owned row showed each name twice with nothing to say
    // which plan it belonged to.
    mockActiveJourney = makeJourney({ id: "jrn-owning" })
    mockSwr([
      makePhasePlan({
        id: "own-go",
        name: "Go-Go",
        independencePlanId: "jrn-owning",
      }),
      makePhasePlan({
        id: "rent-go",
        name: "Go-Go",
        independencePlanId: "jrn-renting",
      }),
      makePhasePlan({
        id: "rent-slow",
        name: "Slow Go",
        independencePlanId: "jrn-renting",
      }),
    ])

    render(<Page />)

    expect(screen.getAllByText("Go-Go")).toHaveLength(1)
    expect(screen.queryByText("Slow Go")).not.toBeInTheDocument()
  })

  it("hands the Plan tab only this plan's phase rows", () => {
    // `plans` flows through useCompositeProjection into context and down to
    // PhaseConfigList, which offers every entry as a timeline candidate and
    // spreads ages across all of them. Handing it every owned row put the
    // other plan's phases on this plan's timeline, one click from being
    // seeded and saved into this plan's composite.
    mockActiveJourney = makeJourney({
      id: "jrn-owning",
      phases: JSON.stringify([{ planId: "plan-owning", fromAge: 60 }]),
    })
    mockSwr([...otherPhases, ownedPhase])

    render(<Page />)

    expect(mockCompositeTab).toHaveBeenCalled()
    const { plans } = mockCompositeTab.mock.calls[0][0] as {
      plans: RetirementPlan[]
    }
    expect(plans.map((p) => p.id)).toEqual(["plan-owning"])
  })

  it("keeps an ungrouped legacy row available to the timeline", () => {
    // Scoping must not strand a row that predates `independencePlanId` — it
    // belongs to no plan, so it stays offered rather than becoming
    // unreachable from every timeline.
    mockActiveJourney = makeJourney({
      id: "jrn-owning",
      phases: JSON.stringify([{ planId: "plan-owning", fromAge: 60 }]),
    })
    mockSwr([
      ...otherPhases,
      ownedPhase,
      makePhasePlan({ id: "plan-legacy", name: "Legacy Plan" }),
    ])

    render(<Page />)

    const { plans } = mockCompositeTab.mock.calls[0][0] as {
      plans: RetirementPlan[]
    }
    expect(plans.map((p) => p.id)).toEqual(["plan-owning", "plan-legacy"])
  })
})

describe("/independence — Add a stage belongs to the journey on screen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockQuery = { view: "stages" }
    global.fetch = mockFetch
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("") })
  })

  const addStage = (): HTMLElement =>
    screen.getByRole("link", { name: /Add a stage/i })

  it("carries the active journey so the new stage is stamped into it", () => {
    // Unstamped, svc-retire lands the stage ungrouped and every journey's
    // stage list then shows it — the wizard can only stamp what it is told.
    mockActiveJourney = makeJourney({ id: "jrn-owning" })
    mockSwr([ownedPhase])

    render(<Page />)

    expect(addStage()).toHaveAttribute(
      "href",
      "/independence/wizard?plan=jrn-owning",
    )
  })

  it("names no journey when the user has none yet", () => {
    // First run: ungrouped is correct, there is nothing to belong to. Sending
    // an empty `plan=` would fail svc-retire's ownership check instead.
    mockActiveJourney = undefined
    mockSwr([makePhasePlan({ id: "plan-legacy", name: "Legacy Plan" })])

    render(<Page />)

    expect(addStage()).toHaveAttribute("href", "/independence/wizard")
  })

  it("keeps the action out of the page header", () => {
    // The header names the journey; a stage action there is a level below it,
    // and from the reading view it had no unambiguous journey to add to.
    mockActiveJourney = makeJourney({ id: "jrn-owning" })
    mockSwr([ownedPhase])

    const { container } = render(<Page />)

    const header = container.querySelector("h1")?.closest("div")?.parentElement
    expect(header).not.toBeNull()
    expect(header?.textContent).not.toMatch(/Add a stage/i)
  })

  it("offers no stage action at all while reading the plan", () => {
    mockActiveJourney = makeJourney({
      id: "jrn-owning",
      phases: JSON.stringify([{ planId: "plan-owning", fromAge: 60 }]),
    })
    mockQuery = { view: "plan" }
    mockSwr([ownedPhase])

    render(<Page />)

    expect(
      screen.queryByRole("link", { name: /Add a stage/i }),
    ).not.toBeInTheDocument()
  })
})

describe("/independence — plan config lives with what it configures", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = mockFetch
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("") })
  })

  it("keeps About you to facts about the person", () => {
    // The plan's display currency and work scenario sat here, under a heading
    // about the user's age. Both are plan config and moved to the surfaces
    // they configure.
    mockQuery = { view: "profile" }
    mockActiveJourney = makeJourney({ id: "jrn-owning" })
    mockSwr([ownedPhase])

    render(<Page />)

    expect(screen.getByTestId("settings-panel")).toBeInTheDocument()
    expect(screen.queryByTestId("composite-settings")).not.toBeInTheDocument()
  })

  it("renders Working years through the composite, so the picker has one writer", () => {
    // The scenario picker must sit inside the composite provider: that hook
    // is the sole writer of journey.workScenarioId, and a second component
    // PATCHing the row directly is overwritten by its stale copy.
    mockQuery = { view: "work" }
    mockActiveJourney = makeJourney({ id: "jrn-owning" })
    mockSwr([ownedPhase])

    render(<Page />)

    expect(mockCompositeTab).toHaveBeenCalled()
    const modes = mockCompositeTab.mock.calls.map(
      (call) => (call[0] as { mode?: string }).mode,
    )
    expect(modes).toContain("work")
  })
})
