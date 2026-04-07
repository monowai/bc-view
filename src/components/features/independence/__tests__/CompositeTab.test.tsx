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
  usePrivacyMode: () => ({ hideValues: false }),
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

  beforeEach(() => {
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
      projection: undefined,
      scenarios: undefined,
      isLoading: false,
      error: null,
    })
  })

  it("renders settings bar (currency selector) on default Plans tab", () => {
    render(<CompositeTab plans={plans} settings={settings} />)
    expect(screen.getByLabelText("Display Currency")).toBeInTheDocument()
  })

  it("renders all four sub-tabs in the navigation", () => {
    render(<CompositeTab plans={plans} settings={settings} />)
    expect(screen.getByRole("tab", { name: /Plans/ })).toBeInTheDocument()
    expect(
      screen.getByRole("tab", { name: /Wealth Journey/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("tab", { name: /Stress Test/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("tab", { name: /Year-by-Year/ }),
    ).toBeInTheDocument()
  })

  it("defaults to the Plans tab and shows phase configuration", () => {
    render(<CompositeTab plans={plans} settings={settings} />)
    expect(screen.getByText("Phase Configuration")).toBeInTheDocument()
    const plansTab = screen.getByRole("tab", { name: /Plans/ })
    expect(plansTab).toHaveAttribute("aria-selected", "true")
  })

  it("does not render Year-by-Year timeline by default", () => {
    render(<CompositeTab plans={plans} settings={settings} />)
    expect(
      screen.queryByText("Year-by-Year Timeline"),
    ).not.toBeInTheDocument()
  })

  it("switches to the Wealth Journey tab when clicked", async () => {
    const { useCompositeProjection } = jest.requireMock(
      "@hooks/useCompositeProjection",
    )
    const projectionState = {
      phases: [{ planId: "p1", fromAge: 60 }],
      setPhases: jest.fn(),
      displayCurrency: "SGD",
      setDisplayCurrency: jest.fn(),
      excludedPlanIds: new Set(),
      toggleExclusion: jest.fn(),
      projection: makeProjection(),
      scenarios: undefined,
      isLoading: false,
      error: null,
    }
    useCompositeProjection.mockReturnValue(projectionState)

    render(<CompositeTab plans={plans} settings={settings} />)
    const wealthTab = screen.getByRole("tab", { name: /Wealth Journey/ })
    await userEvent.click(wealthTab)

    expect(wealthTab).toHaveAttribute("aria-selected", "true")
    // Heading inside the wealth tab content (not the tab button label)
    expect(
      screen.getByRole("heading", { name: /Wealth Journey/ }),
    ).toBeInTheDocument()
  })

  it("switches to the Year-by-Year tab when clicked", async () => {
    const { useCompositeProjection } = jest.requireMock(
      "@hooks/useCompositeProjection",
    )
    const projectionState = {
      phases: [{ planId: "p1", fromAge: 60 }],
      setPhases: jest.fn(),
      displayCurrency: "SGD",
      setDisplayCurrency: jest.fn(),
      excludedPlanIds: new Set(),
      toggleExclusion: jest.fn(),
      projection: makeProjection(),
      scenarios: undefined,
      isLoading: false,
      error: null,
    }
    useCompositeProjection.mockReturnValue(projectionState)

    render(<CompositeTab plans={plans} settings={settings} />)
    await userEvent.click(
      screen.getByRole("tab", { name: /Year-by-Year/ }),
    )

    expect(screen.getByText("Year-by-Year Timeline")).toBeInTheDocument()
  })

  it("switches to the Stress Test tab when clicked", async () => {
    render(<CompositeTab plans={plans} settings={settings} />)
    await userEvent.click(screen.getByRole("tab", { name: /Stress Test/ }))
    expect(
      screen.getByRole("button", { name: /Run Stress Test/ }),
    ).toBeInTheDocument()
  })

  it("renders error inside Plans tab when present", () => {
    const { useCompositeProjection } = jest.requireMock(
      "@hooks/useCompositeProjection",
    )
    useCompositeProjection.mockReturnValueOnce({
      phases: [],
      setPhases: jest.fn(),
      displayCurrency: "SGD",
      setDisplayCurrency: jest.fn(),
      excludedPlanIds: new Set(),
      toggleExclusion: jest.fn(),
      projection: undefined,
      scenarios: undefined,
      isLoading: false,
      error: "Something went wrong",
    })

    render(<CompositeTab plans={plans} settings={settings} />)
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
  })

  it("renders loading spinner inside Plans tab when loading", () => {
    const { useCompositeProjection } = jest.requireMock(
      "@hooks/useCompositeProjection",
    )
    useCompositeProjection.mockReturnValueOnce({
      phases: [{ planId: "p1", fromAge: 60 }],
      setPhases: jest.fn(),
      displayCurrency: "SGD",
      setDisplayCurrency: jest.fn(),
      excludedPlanIds: new Set(),
      toggleExclusion: jest.fn(),
      projection: undefined,
      scenarios: undefined,
      isLoading: true,
      error: null,
    })

    render(<CompositeTab plans={plans} settings={settings} />)
    expect(
      screen.getByText("Calculating composite projection..."),
    ).toBeInTheDocument()
  })
})
