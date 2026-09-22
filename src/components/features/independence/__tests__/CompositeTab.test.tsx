import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import CompositeTab from "../CompositeTab"
import type {
  CompositeProjectionResult,
  RetirementPlan,
  UserIndependenceSettings,
} from "types/independence"

// Mock recharts: in JSDOM the real ResponsiveContainer has width/height 0
// and logs "The width(-1) and height(-1) of chart should be greater than 0".
// Rendering the chart as <svg> with <g> children also keeps the camelCase
// SVG tags (<defs>, <linearGradient>, <stop>) in a valid SVG context so
// React doesn't warn about their casing.
jest.mock("recharts", () => ({
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <svg data-testid="composed-chart">{children}</svg>
  ),
  Area: () => <g />,
  Line: () => <g />,
  XAxis: () => <g />,
  YAxis: () => <g />,
  CartesianGrid: () => <g />,
  Tooltip: () => <g />,
  Legend: () => <g />,
  ReferenceLine: () => <g />,
  ReferenceArea: () => <g />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div style={{ width: 800, height: 400 }}>{children}</div>
  ),
}))

// Mock the hooks
jest.mock("@hooks/useCompositeProjection", () => ({
  useCompositeProjection: jest.fn(() => ({
    phases: [
      { planId: "p1", fromAge: 60, toAge: 75 },
      { planId: "p2", fromAge: 75 },
    ],
    setPhases: jest.fn(),
    displayCurrency: "SGD",
    setDisplayCurrency: jest.fn(),
    excludedPlanIds: new Set(),
    toggleExclusion: jest.fn(),
    projection: undefined,
    scenarios: undefined,
    isLoading: false,
    error: null,
  })),
}))

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: jest.fn(() => ({ hideValues: false })),
}))

jest.mock("@hooks/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({
    settings: { yearOfBirth: 1970, lifeExpectancy: 90 },
    isLoading: false,
    settingsError: undefined,
    updateSettings: jest.fn(),
    mutateSettings: jest.fn(),
  }),
}))

// Its own wiring (debounced single-field PATCH, provenance echo) is covered
// by JourneyAssumptionsSection.test; here we only assert the mode renders it.
jest.mock(
  "@components/features/independence/composite/tabs/JourneyAssumptionsSection",
  () => ({
    __esModule: true,
    default: (): React.ReactElement => (
      <div data-testid="journey-assumptions-section" />
    ),
  }),
)

jest.mock("@hooks/useCompositeMonteCarloSimulation", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    result: null,
    isRunning: false,
    error: null,
    runSimulation: jest.fn(),
  })),
  useCompositeMonteCarloSimulation: jest.fn(() => ({
    result: null,
    isRunning: false,
    error: null,
    runSimulation: jest.fn(),
  })),
}))

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

const settings: UserIndependenceSettings = {
  id: "s1",
  ownerId: "owner-1",
  yearOfBirth: 1970,
  lifeExpectancy: 90,
  createdDate: "2025-01-01",
  updatedDate: "2025-01-01",
}

function makeProjection(): CompositeProjectionResult {
  return {
    yearlyProjections: [
      {
        year: 2030,
        age: 60,
        planId: "p1",
        planName: "Asia Plan",
        startingBalance: 100000,
        endingBalance: 105000,
        totalWealth: 150000,
        income: 12000,
        expenses: 7000,
      },
      {
        year: 2031,
        age: 61,
        planId: "p1",
        planName: "Asia Plan",
        startingBalance: 105000,
        endingBalance: 110000,
        totalWealth: 155000,
        income: 12000,
        expenses: 7000,
      },
    ],
    phases: [{ planId: "p1", planName: "Asia Plan", fromAge: 60, toAge: 75 }],
    isSustainable: true,
    depletionAge: null,
    runwayYears: 30,
  } as unknown as CompositeProjectionResult
}

describe("CompositeTab", () => {
  const plans = [
    makePlan({ id: "p1", name: "Asia Plan", isPrimary: true }),
    makePlan({ id: "p2", name: "Europe Plan" }),
  ]

  const mockProjection = (overrides: Record<string, unknown> = {}): void => {
    const { useCompositeProjection } = jest.requireMock(
      "@hooks/useCompositeProjection",
    )
    useCompositeProjection.mockReturnValue({
      phases: [
        { planId: "p1", fromAge: 60, toAge: 75 },
        { planId: "p2", fromAge: 75 },
      ],
      setPhases: jest.fn(),
      displayCurrency: "SGD",
      setDisplayCurrency: jest.fn(),
      excludedPlanIds: new Set(),
      toggleExclusion: jest.fn(),
      compositeWorkScenarioId: undefined,
      setCompositeWorkScenarioId: jest.fn(),
      refreshProjection: jest.fn(),
      currentAge: 58,
      projection: undefined,
      scenarios: undefined,
      isLoading: false,
      isSettled: true,
      error: null,
      ...overrides,
    })
  }

  beforeEach(() => mockProjection())

  it("leads with the verdict, not with a tab bar", () => {
    // The old shape put seven sub-tabs above everything and landed on a list
    // of spending boards; whether the plan worked was four tabs away.
    mockProjection({ projection: makeProjection() })
    render(<CompositeTab plans={plans} settings={settings} />)

    expect(
      screen.getByRole("heading", { name: /Your money lasts to age/ }),
    ).toBeInTheDocument()
    expect(screen.queryAllByRole("tab")).toHaveLength(0)
  })

  it("states the verdict in the reader's words and backs it with numbers", () => {
    mockProjection({ projection: makeProjection() })
    render(<CompositeTab plans={plans} settings={settings} />)

    expect(screen.getByText("Your money lasts to age 61.")).toBeInTheDocument()
    expect(screen.getByText("Holds up")).toBeInTheDocument()
    expect(screen.getByText("Target to retire on")).toBeInTheDocument()
  })

  it("pairs the verdict status with a word, never colour alone", () => {
    mockProjection({
      projection: {
        ...makeProjection(),
        isSustainable: false,
        depletionAge: 78,
      } as never,
    })
    render(<CompositeTab plans={plans} settings={settings} />)

    expect(
      screen.getByText("Your money runs out at age 78."),
    ).toBeInTheDocument()
    expect(screen.getByText("Needs a look")).toBeInTheDocument()
  })

  it("offers one chart with two lenses instead of three chart tabs", async () => {
    mockProjection({ projection: makeProjection() })
    render(<CompositeTab plans={plans} settings={settings} />)

    const lasts = screen.getByRole("button", { name: "Will it last?" })
    const madeOf = screen.getByRole("button", { name: "What it's made of" })
    expect(lasts).toHaveAttribute("aria-pressed", "true")
    expect(madeOf).toHaveAttribute("aria-pressed", "false")

    await userEvent.click(madeOf)
    expect(madeOf).toHaveAttribute("aria-pressed", "true")
    expect(lasts).toHaveAttribute("aria-pressed", "false")
  })

  it("attaches the stress test to the chart it changes", () => {
    mockProjection({ projection: makeProjection() })
    render(<CompositeTab plans={plans} settings={settings} />)

    // Previously its own tab, running the same simulation as the FI tab with
    // a second, independent iteration picker.
    expect(screen.getByText("Test it against bad markets")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Run the test" }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("combobox")).toHaveLength(1)
  })

  it("keeps the year-by-year ledger closed until asked for", () => {
    mockProjection({ projection: makeProjection() })
    const { container } = render(
      <CompositeTab plans={plans} settings={settings} />,
    )

    const disclosure = container.querySelector("details")
    expect(disclosure).not.toBeNull()
    expect(disclosure).not.toHaveAttribute("open")
    expect(
      screen.getByText("Show the year-by-year numbers"),
    ).toBeInTheDocument()
  })

  it("says what is missing rather than rendering an empty page", () => {
    // With no stages useCompositeProjection returns early without setting an
    // error, so every section rendered null and the page went silent.
    mockProjection({ phases: [], projection: undefined })
    render(<CompositeTab plans={plans} settings={settings} />)

    expect(screen.getByText("Nothing to project yet")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Set up your stages/ }),
    ).toBeInTheDocument()
  })

  it("owns up when stages exist but no projection came back", () => {
    mockProjection({ projection: undefined })
    render(<CompositeTab plans={plans} settings={settings} />)

    expect(
      screen.getByText(/couldn't work out your projection/),
    ).toBeInTheDocument()
  })

  it("waits rather than claiming failure while the projection is still coming", () => {
    // `setIsLoading(true)` lives inside the fetch debounce, so between seeding
    // the phases and the timer firing there is a window with no projection and
    // nothing marked in flight. That window rendered "we couldn't work out
    // your projection" — a failure notice for a request that had not been
    // made yet.
    mockProjection({ isSettled: false, projection: undefined })
    render(<CompositeTab plans={plans} settings={settings} />)

    expect(
      screen.queryByText(/couldn't work out your projection/),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("does not claim there is nothing to project before the plan has been read", () => {
    // Phases are empty until the journey is seeded, which is a state the
    // reader should never be shown — it accuses them of an unbuilt plan.
    mockProjection({ isSettled: false, phases: [], projection: undefined })
    render(<CompositeTab plans={plans} settings={settings} />)

    expect(screen.queryByText("Nothing to project yet")).not.toBeInTheDocument()
  })

  it("surfaces a projection error", () => {
    mockProjection({ error: "svc-retire said no" })
    render(<CompositeTab plans={plans} settings={settings} />)
    expect(screen.getByText("svc-retire said no")).toBeInTheDocument()
  })

  it("renders settings in setup mode, never alongside the charts", () => {
    mockProjection({ projection: makeProjection() })
    const { rerender } = render(
      <CompositeTab plans={plans} settings={settings} mode="plan" />,
    )
    expect(screen.queryByTestId("phases-layout")).not.toBeInTheDocument()

    rerender(<CompositeTab plans={plans} settings={settings} mode="stages" />)
    expect(screen.getByTestId("phases-layout")).toBeInTheDocument()
    expect(screen.queryByText(/Your money lasts/)).not.toBeInTheDocument()
  })

  it("hides the age as well as the amounts in privacy mode", () => {
    // Masking only the headline left the depletion/FI age in plain sight in
    // the supporting sentence and the milestone tile — an age discloses as
    // much to a shoulder-surfer as a balance does.
    const { usePrivacyMode } = jest.requireMock("@hooks/usePrivacyMode")
    usePrivacyMode.mockReturnValue({ hideValues: true })
    mockProjection({
      projection: {
        ...makeProjection(),
        isSustainable: false,
        depletionAge: 78,
      } as never,
    })
    render(<CompositeTab plans={plans} settings={settings} />)

    expect(screen.queryByText(/age 78/)).not.toBeInTheDocument()
    expect(screen.queryByText(/runs out at age/)).not.toBeInTheDocument()
    expect(screen.getByText("Your plan is hidden.")).toBeInTheDocument()

    usePrivacyMode.mockReturnValue({ hideValues: false })
  })

  it("renders the journey assumptions editor in assumptions mode only", () => {
    mockProjection({ projection: makeProjection() })
    const { rerender } = render(
      <CompositeTab plans={plans} settings={settings} mode="plan" />,
    )
    expect(
      screen.queryByTestId("journey-assumptions-section"),
    ).not.toBeInTheDocument()

    rerender(
      <CompositeTab plans={plans} settings={settings} mode="assumptions" />,
    )
    expect(
      screen.getByTestId("journey-assumptions-section"),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Your money lasts/)).not.toBeInTheDocument()
  })

  it("carries no composite narrative field", () => {
    // Narrative belongs to each phase's own plan, not the composite.
    render(<CompositeTab plans={plans} settings={settings} />)
    expect(screen.queryByText(/Plan narrative/)).not.toBeInTheDocument()
    expect(document.querySelector("textarea")).toBeNull()
  })
})
