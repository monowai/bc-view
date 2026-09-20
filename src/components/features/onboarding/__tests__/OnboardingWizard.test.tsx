import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { IndependencePlan } from "types/independence"

// Only the steps this suite does not exercise are stubbed — step 5's own
// component stays real so the "already have a plan" copy is asserted where
// the user actually reads it.
jest.mock("../steps/WelcomeStep", () => ({
  __esModule: true,
  default: () => <div data-testid="step-welcome" />,
}))
jest.mock("../steps/CurrencyStep", () => ({
  __esModule: true,
  default: () => <div data-testid="step-currency" />,
}))
jest.mock("../steps/AssetsStep", () => ({
  __esModule: true,
  default: () => <div data-testid="step-assets" />,
}))
jest.mock("../steps/ReviewStep", () => ({
  __esModule: true,
  default: () => <div data-testid="step-review" />,
}))
jest.mock("../steps/BrokerageStep", () => ({
  __esModule: true,
  default: () => <div data-testid="step-brokerage" />,
}))
jest.mock("../steps/CompleteStep", () => ({
  __esModule: true,
  default: () => <div data-testid="step-complete" />,
}))

jest.mock("swr", () => ({
  __esModule: true,
  default: () => ({ data: { data: [] }, error: null, isLoading: false }),
}))

let mockJourneys: IndependencePlan[] = []

jest.mock("@hooks/useIndependencePlans", () => ({
  useIndependencePlans: () => ({
    plans: mockJourneys,
    error: undefined,
    isLoading: false,
  }),
}))

jest.mock("@contexts/RegistrationContext", () => ({
  useRegistration: () => ({ markOnboardingComplete: jest.fn() }),
}))

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({ preferences: null, isLoading: false }),
}))

const mockGeneratePhasedPlans = jest.fn()
jest.mock("@lib/onboarding/generatePhasedPlans", () => ({
  generatePhasedPlans: (planId: string, force?: boolean) =>
    mockGeneratePhasedPlans(planId, force),
}))

const mockSaveExpenses = jest.fn()
jest.mock("@lib/onboarding/saveIndependenceExpenses", () => ({
  saveOnboardingExpenses: (...args: unknown[]) => mockSaveExpenses(...args),
}))

import OnboardingWizard from "../OnboardingWizard"

const PLANS_URL = "/api/independence/plans"

function makeJourney(id: string): IndependencePlan {
  return {
    id,
    ownerId: "owner-1",
    name: "A Journey",
    isPrimary: true,
    createdDate: "2026-01-01",
    updatedDate: "2026-01-01",
  }
}

/** Every backend call the wizard makes succeeds with a plausible body. */
function stubFetch(): jest.Mock {
  const fetchMock = jest.fn((url: string) => {
    const body =
      url === "/api/portfolios"
        ? { data: [{ id: "pf-1", code: "SGD" }] }
        : url === PLANS_URL
          ? { data: { id: "plan-1" } }
          : { data: [] }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(""),
    })
  })
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

/** Continue through steps 1-5 and press Complete Setup on step 6. */
async function walkToCompletion(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
  }
  fireEvent.click(screen.getByRole("button", { name: "Complete Setup" }))
  await waitFor(() =>
    expect(screen.getByTestId("step-complete")).toBeInTheDocument(),
  )
}

/** Continue through steps 1-4 so step 5 is on screen. */
function walkToIndependenceStep(): void {
  for (let i = 0; i < 4; i += 1) {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
  }
}

describe("OnboardingWizard — step 5 decides from server state", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockJourneys = []
  })

  it("creates the stage and forces phasing on a genuinely first run", async () => {
    const fetchMock = stubFetch()

    render(<OnboardingWizard />)
    await walkToCompletion()

    const planPosts = fetchMock.mock.calls.filter(([url]) => url === PLANS_URL)
    expect(planPosts).toHaveLength(1)
    expect(mockGeneratePhasedPlans).toHaveBeenCalledWith("plan-1", true)
  })

  it("creates no stage and calls no phasing when a journey already exists", async () => {
    mockJourneys = [makeJourney("jrn-1")]
    const fetchMock = stubFetch()

    render(<OnboardingWizard />)
    await walkToCompletion()

    expect(
      fetchMock.mock.calls.filter(([url]) => url === PLANS_URL),
    ).toHaveLength(0)
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/independence/work-scenarios",
      ),
    ).toHaveLength(0)
    expect(mockGeneratePhasedPlans).not.toHaveBeenCalled()
  })

  it("tells the user on step 5 that they already have a plan, with no toggle", () => {
    mockJourneys = [makeJourney("jrn-1")]
    stubFetch()

    render(<OnboardingWizard />)
    walkToIndependenceStep()

    expect(
      screen.getByText(/you already have an independence plan/i),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /view it/i })).toHaveAttribute(
      "href",
      "/independence",
    )
    expect(
      screen.queryByRole("button", { name: /yes, let's do it/i }),
    ).not.toBeInTheDocument()
  })

  it("still offers the independence step to a user with no journey", () => {
    stubFetch()

    render(<OnboardingWizard />)
    walkToIndependenceStep()

    expect(
      screen.getByRole("button", { name: /yes, let's do it/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/you already have an independence plan/i),
    ).not.toBeInTheDocument()
  })
})
