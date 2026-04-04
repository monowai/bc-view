import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import CompositeTab from "../CompositeTab"
import type { RetirementPlan, UserIndependenceSettings } from "types/independence"

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

describe("CompositeTab", () => {
  const plans = [
    makePlan({ id: "p1", name: "Asia Plan", isPrimary: true }),
    makePlan({ id: "p2", name: "Europe Plan" }),
  ]

  it("renders currency selector", () => {
    render(<CompositeTab plans={plans} settings={settings} />)

    expect(screen.getByLabelText("Display Currency")).toBeInTheDocument()
  })

  it("renders settings button", () => {
    render(<CompositeTab plans={plans} settings={settings} />)

    expect(screen.getByText("Settings")).toBeInTheDocument()
  })

  it("renders phase configuration", () => {
    render(<CompositeTab plans={plans} settings={settings} />)

    expect(screen.getByText("Phase Configuration")).toBeInTheDocument()
  })

  it("does not render timeline when no projection", () => {
    render(<CompositeTab plans={plans} settings={settings} />)

    expect(
      screen.queryByText("Year-by-Year Timeline"),
    ).not.toBeInTheDocument()
  })

  it("renders error when present", () => {
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

  it("renders loading spinner when loading", () => {
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
