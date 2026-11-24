import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSwr from "swr"
import type { NetWorth } from "types/beancounter"
import type {
  CompositeProjectionResult,
  IndependencePlan,
  RetirementPlan,
} from "types/independence"
import type { WealthSummary } from "@lib/wealth/liquidityGroups"
import { makeNetWorth } from "@test-fixtures/beancounter"
import { makeCompositeProjection } from "@test-fixtures/independence"

// ── SWR: keyed by url so /api/independence/plans can be shaped per test ──────

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))

// ── Journeys (independence plans) ───────────────────────────────────────────

let mockJourneys: IndependencePlan[] = []

jest.mock("@hooks/useIndependencePlans", () => ({
  useIndependencePlans: () => ({
    plans: mockJourneys,
    error: undefined,
    isLoading: false,
  }),
}))

// ── Everything the dashboard needs but this suite doesn't exercise ──────────

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({
    preferences: { baseCurrencyCode: "USD", enableTwr: false },
    isLoading: false,
  }),
}))

jest.mock("@hooks/useFxRates", () => ({
  useFxRates: () => ({
    displayCurrency: { code: "USD", symbol: "$", name: "US Dollar" },
    setDisplayCurrency: jest.fn(),
    fxRates: { USD: 1 },
    fxReady: true,
  }),
}))

// `useFiProjectionSimple` receives the resolved plan — spied on so the
// assertion doesn't depend on how IndependenceMetrics chooses to render it.
const mockFiProjection = jest.fn()

jest.mock("@components/features/independence", () => ({
  useAssetBreakdown: () => ({}),
  useFiProjectionSimple: (args: { plan?: RetirementPlan }) => {
    mockFiProjection(args)
    return { projection: undefined, isLoading: false }
  },
}))

jest.mock("@components/features/wealth/IndependenceMetrics", () => ({
  __esModule: true,
  default: ({
    primaryPlan,
    journey,
    journeyProjection,
    journeyProjectionLoading,
    journeyProjectionFailed,
  }: {
    primaryPlan: RetirementPlan
    journey?: IndependencePlan
    journeyProjection: CompositeProjectionResult | null
    journeyProjectionLoading: boolean
    journeyProjectionFailed: boolean
  }) => (
    <div data-testid="independence-metrics">
      {primaryPlan.name}
      <span data-testid="journey">{journey?.id}</span>
      <span data-testid="journey-draw">
        {journeyProjection?.plannedAnnualDraw}
      </span>
      <span data-testid="journey-loading">
        {String(journeyProjectionLoading)}
      </span>
      <span data-testid="journey-failed">
        {String(journeyProjectionFailed)}
      </span>
    </div>
  ),
}))

jest.mock("@components/features/wealth/WealthHeroSection", () => ({
  __esModule: true,
  default: ({ summary }: { summary: WealthSummary }) => (
    <div data-testid="hero">
      <span data-testid="total-value">{summary.totalValue}</span>
      <span data-testid="gain-on-day">{summary.totalGainOnDay}</span>
      <span data-testid="healthcare-reserve">{summary.healthcareReserve}</span>
    </div>
  ),
}))
jest.mock("@components/features/wealth/AssetAllocationCharts", () => ({
  __esModule: true,
  default: () => <div data-testid="charts" />,
}))
jest.mock("@components/features/wealth/PortfolioDetailsTable", () => ({
  __esModule: true,
  default: () => <div data-testid="details" />,
}))
jest.mock("@components/features/wealth/QuickActionCards", () => ({
  __esModule: true,
  default: () => <div data-testid="quick-actions" />,
}))
jest.mock("@components/features/wealth/WealthPerformanceChart", () => ({
  __esModule: true,
  default: () => <div data-testid="performance" />,
}))
jest.mock("@components/features/portfolios/ShareInviteDialog", () => ({
  __esModule: true,
  default: () => <div data-testid="share" />,
}))

import Wealth from "@pages/wealth"

const WealthPage = Wealth as React.ComponentType<Record<string, unknown>>

function makeJourney(
  overrides: Partial<IndependencePlan> & { id: string },
): IndependencePlan {
  return {
    ownerId: "owner-1",
    name: "A Journey",
    isPrimary: false,
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

const portfolio = {
  id: "pf-1",
  code: "ALPHA",
  name: "Alpha",
  base: { id: "usd", code: "USD", symbol: "$", name: "US Dollar" },
  currency: { id: "usd", code: "USD", symbol: "$", name: "US Dollar" },
  marketValue: 100_000,
}

/** Shape the SWR responses; /api/independence/plans and /api/net-worth vary per test. */
function mockSwr(
  phasePlans: RetirementPlan[],
  netWorth: NetWorth = makeNetWorth(),
): void {
  ;(useSwr as jest.Mock).mockImplementation((key: string | null) => {
    if (key === "/api/independence/plans") {
      return { data: { data: phasePlans }, error: null, isLoading: false }
    }
    if (typeof key === "string" && key.startsWith("/api/net-worth")) {
      return { data: { data: netWorth }, error: null, isLoading: false }
    }
    if (typeof key === "string" && key.includes("/holdings/")) {
      return {
        data: { data: { positions: {} } },
        error: null,
        isLoading: false,
      }
    }
    if (typeof key === "string" && key.includes("/currencies")) {
      return {
        data: { data: [{ id: "usd", code: "USD", symbol: "$", name: "USD" }] },
        error: null,
        isLoading: false,
      }
    }
    if (typeof key === "string" && key.includes("/portfolios")) {
      return { data: { data: [portfolio] }, error: null, isLoading: false }
    }
    return { data: undefined, error: null, isLoading: false }
  })
}

describe("/wealth — independence headline resolves through the primary plan", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockJourneys = []
  })

  /**
   * The list deliberately puts the *other* journey's phase plan first, and
   * flags it primary, so neither `data[0]` nor a flat `find(isPrimary)` over
   * every plan can pass by accident.
   */
  const rentingPhase = makePhasePlan({
    id: "plan-renting",
    name: "Renting Go-Go",
    independencePlanId: "jrn-renting",
    isPrimary: true,
  })
  const owningPhase = makePhasePlan({
    id: "plan-owning",
    name: "Owning Go-Go",
    independencePlanId: "jrn-owning",
  })

  it("names the primary plan's own phase, not the first row returned", () => {
    mockJourneys = [
      makeJourney({ id: "jrn-renting", name: "Renting" }),
      makeJourney({
        id: "jrn-owning",
        name: "With Property",
        isPrimary: true,
        phases: JSON.stringify([{ planId: "plan-owning", fromAge: 60 }]),
      }),
    ]
    mockSwr([rentingPhase, owningPhase])

    render(<WealthPage />)

    expect(screen.getByTestId("independence-metrics")).toHaveTextContent(
      "Owning Go-Go",
    )
    expect(mockFiProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: expect.objectContaining({ id: "plan-owning" }),
      }),
    )
  })

  it("follows the primary flag rather than list order across plans", () => {
    // Same rows, primary moved to the other journey: the headline has to move
    // with it. Any index-based pick would report the same plan in both tests.
    mockJourneys = [
      makeJourney({
        id: "jrn-renting",
        name: "Renting",
        isPrimary: true,
        phases: JSON.stringify([{ planId: "plan-renting", fromAge: 60 }]),
      }),
      makeJourney({ id: "jrn-owning", name: "With Property" }),
    ]
    mockSwr([owningPhase, rentingPhase])

    render(<WealthPage />)

    expect(screen.getByTestId("independence-metrics")).toHaveTextContent(
      "Renting Go-Go",
    )
  })

  it("takes the earliest phase of the primary plan when no phase is flagged primary", () => {
    const slowGo = makePhasePlan({
      id: "plan-slow",
      name: "Owning Slow-Go",
      independencePlanId: "jrn-owning",
    })
    mockJourneys = [
      makeJourney({
        id: "jrn-owning",
        name: "With Property",
        isPrimary: true,
        // Deliberately out of age order — the timeline, not the array, decides.
        phases: JSON.stringify([
          { planId: "plan-slow", fromAge: 75 },
          { planId: "plan-owning", fromAge: 60, toAge: 75 },
        ]),
      }),
    ]
    mockSwr([slowGo, owningPhase])

    render(<WealthPage />)

    expect(screen.getByTestId("independence-metrics")).toHaveTextContent(
      "Owning Go-Go",
    )
  })

  it("degrades to the user's primary phase plan when no plan row exists", () => {
    // Legacy account: phase plans but no independence_plan rows yet. Order
    // still must not decide — the flagged plan wins.
    mockJourneys = []
    mockSwr([owningPhase, rentingPhase])

    render(<WealthPage />)

    expect(screen.getByTestId("independence-metrics")).toHaveTextContent(
      "Renting Go-Go",
    )
  })

  it("hides the independence section when nothing resolves", () => {
    mockJourneys = []
    mockSwr([])

    render(<WealthPage />)

    expect(screen.queryByTestId("independence-metrics")).not.toBeInTheDocument()
  })
})

describe("/wealth — retired tiles are fed by the primary journey", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockJourneys = []
  })

  const owningPhase = makePhasePlan({
    id: "plan-owning",
    name: "Owning Go-Go",
    independencePlanId: "jrn-owning",
  })
  const journeys = (): IndependencePlan[] => [
    makeJourney({
      id: "jrn-renting",
      name: "Renting",
      displayCurrency: "USD",
      phases: JSON.stringify([{ planId: "plan-renting", fromAge: 60 }]),
    }),
    makeJourney({
      id: "jrn-owning",
      name: "With Property",
      isPrimary: true,
      displayCurrency: "USD",
      phases: JSON.stringify([{ planId: "plan-owning", fromAge: 60 }]),
    }),
  ]

  /** Answer the journey projection request for one journey id only. */
  function mockJourneyProjection(
    journeyId: string,
    response: {
      data?: CompositeProjectionResult
      isLoading?: boolean
      error?: Error
    },
  ): void {
    const base = (useSwr as jest.Mock).getMockImplementation() as (
      key: unknown,
    ) => unknown
    ;(useSwr as jest.Mock).mockImplementation((key: unknown) =>
      Array.isArray(key) &&
      key[0] === "/api/independence/composite/projection" &&
      key.includes(journeyId)
        ? { error: undefined, isLoading: false, ...response }
        : base(key),
    )
  }

  it("passes the primary journey and its projection to the metrics", () => {
    mockJourneys = journeys()
    mockSwr([owningPhase])
    mockJourneyProjection("jrn-owning", {
      data: makeCompositeProjection({
        currentAge: 66,
        retirementAge: 65,
        plannedAnnualDraw: 54_321,
      }),
    })

    render(<WealthPage />)

    expect(screen.getByTestId("journey")).toHaveTextContent("jrn-owning")
    expect(screen.getByTestId("journey-draw")).toHaveTextContent("54321")
    expect(screen.getByTestId("journey-loading")).toHaveTextContent("false")
  })

  it("tells the metrics when the journey projection failed", () => {
    mockJourneys = journeys()
    mockSwr([owningPhase])
    mockJourneyProjection("jrn-owning", { error: new Error("HTTP 500") })

    render(<WealthPage />)

    expect(screen.getByTestId("journey-failed")).toHaveTextContent("true")
    expect(screen.getByTestId("journey-draw")).toBeEmptyDOMElement()
  })

  it("tells the metrics while the journey projection is still loading", () => {
    mockJourneys = journeys()
    mockSwr([owningPhase])
    mockJourneyProjection("jrn-owning", { isLoading: true })

    render(<WealthPage />)

    expect(screen.getByTestId("journey-loading")).toHaveTextContent("true")
    expect(screen.getByTestId("journey-draw")).toBeEmptyDOMElement()
  })

  it("passes no journey projection for a legacy account with no journey", () => {
    mockJourneys = []
    mockSwr([{ ...owningPhase, isPrimary: true }])

    render(<WealthPage />)

    expect(screen.getByTestId("journey")).toBeEmptyDOMElement()
    expect(screen.getByTestId("journey-draw")).toBeEmptyDOMElement()
    expect(screen.getByTestId("journey-loading")).toHaveTextContent("false")
  })
})

describe("/wealth — independence empty state", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockJourneys = []
  })

  const owningPhase = makePhasePlan({
    id: "plan-owning",
    name: "Owning Go-Go",
    independencePlanId: "jrn-owning",
  })

  it("offers a way into independence when the user has no plan", () => {
    mockJourneys = []
    mockSwr([])

    render(<WealthPage />)

    expect(screen.getByText("No independence plan yet")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Map out your stages and we'll show when work becomes optional.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Plan your independence" }),
    ).toHaveAttribute("href", "/independence")
  })

  it("shows the metrics, not the empty state, once a plan exists", () => {
    mockJourneys = [
      makeJourney({
        id: "jrn-owning",
        name: "With Property",
        isPrimary: true,
        phases: JSON.stringify([{ planId: "plan-owning", fromAge: 60 }]),
      }),
    ]
    mockSwr([owningPhase])

    render(<WealthPage />)

    expect(screen.getByTestId("independence-metrics")).toBeInTheDocument()
    expect(
      screen.queryByText("No independence plan yet"),
    ).not.toBeInTheDocument()
  })
})

describe("/wealth — net worth headline", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockJourneys = []
  })

  it("renders the headline from the net-worth endpoint", () => {
    // The persisted portfolio marketValue above is deliberately different
    // from the endpoint's total: the page must show the server's number.
    mockSwr(
      [],
      makeNetWorth({
        totalValue: 123456,
        gainOnDay: 789,
        healthcareReserve: 4321,
      }),
    )

    render(<WealthPage />)

    expect(screen.getByTestId("total-value")).toHaveTextContent("123456")
    expect(screen.getByTestId("gain-on-day")).toHaveTextContent("789")
    expect(screen.getByTestId("healthcare-reserve")).toHaveTextContent("4321")
  })

  it("asks svc-position for today's net worth in the display currency", () => {
    mockSwr([])

    render(<WealthPage />)

    const keys = (useSwr as jest.Mock).mock.calls.map((call) => call[0])
    expect(keys).toContain("/api/net-worth?asAt=today&currency=USD")
  })

  it("shows the loader until the net worth arrives", () => {
    mockSwr([])
    const base = (useSwr as jest.Mock).getMockImplementation() as (
      key: string | null,
    ) => unknown
    ;(useSwr as jest.Mock).mockImplementation((key: string | null) =>
      typeof key === "string" && key.startsWith("/api/net-worth")
        ? { data: undefined, error: null, isLoading: true }
        : base(key),
    )

    render(<WealthPage />)

    expect(screen.queryByTestId("hero")).not.toBeInTheDocument()
  })

  it("keeps the spinner until holdings have loaded", () => {
    // The headline lands before the holdings call; the charts must not get
    // a chance to render "No allocation data available" in between.
    mockSwr([])
    const base = (useSwr as jest.Mock).getMockImplementation() as (
      key: string | null,
    ) => unknown
    ;(useSwr as jest.Mock).mockImplementation((key: string | null) =>
      typeof key === "string" && key.includes("/holdings/")
        ? { data: undefined, error: null, isLoading: true }
        : base(key),
    )

    render(<WealthPage />)

    expect(screen.queryByTestId("hero")).not.toBeInTheDocument()
    expect(screen.queryByTestId("charts")).not.toBeInTheDocument()
  })

  it("shows an error state when the net-worth request fails", () => {
    mockSwr([])
    const base = (useSwr as jest.Mock).getMockImplementation() as (
      key: string | null,
    ) => unknown
    ;(useSwr as jest.Mock).mockImplementation((key: string | null) =>
      typeof key === "string" && key.startsWith("/api/net-worth")
        ? {
            data: undefined,
            error: new Error("svc-position unavailable"),
            isLoading: false,
          }
        : base(key),
    )

    render(<WealthPage />)

    expect(screen.getByText("Error retrieving net worth")).toBeInTheDocument()
    expect(screen.queryByTestId("hero")).not.toBeInTheDocument()
    expect(screen.queryByTestId("total-value")).not.toBeInTheDocument()
  })
})
