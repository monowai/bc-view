import Home from "@pages/index"
import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import {
  registrationSuccess,
  portfolioResult,
} from "../../__fixtures__/fixtures"
import { enableFetchMocks } from "jest-fetch-mock"
import simpleGit from "../../../__mocks__/simple-git"

enableFetchMocks()

// Mock RegistrationContext to return registered state immediately
jest.mock("../../contexts/RegistrationContext", () => ({
  useRegistration: () => ({
    isChecking: false,
    isRegistered: true,
    isNewlyRegistered: false,
    isOnboardingComplete: true,
    markOnboardingComplete: jest.fn(),
    error: null,
  }),
  RegistrationProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}))

// Mock UserPreferencesContext to avoid loading state
jest.mock("../../contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({
    preferences: {
      baseCurrencyCode: "USD",
      reportingCurrencyCode: "USD",
      preferredName: "Test User",
    },
    isLoading: false,
    error: null,
  }),
  UserPreferencesProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}))

describe("<Home />", () => {
  beforeEach(() => {
    fetchMock.resetMocks()
    // Set localStorage to indicate onboarding is complete
    localStorage.setItem("bc_onboarding_complete", "true")
  })

  afterEach(() => {
    localStorage.clear()
  })

  test("renders for authorised user", async () => {
    const git = simpleGit()
    expect(git)

    // Mock the fetch calls in order:
    // 1. /api/me - registration check (called by useAutoRegister, but mocked)
    // 2. /api/portfolios - portfolio list (called by useSwr)
    fetchMock.mockResponseOnce(JSON.stringify(registrationSuccess))
    fetchMock.mockResponseOnce(JSON.stringify(portfolioResult))

    render(<Home />)

    // Use waitFor for elements that will appear due to async operations
    await waitFor(() => {
      expect(screen.getByText("home.welcome")).toBeInTheDocument()
    })

    // Check for the three domain cards on the landing page
    expect(screen.getByText("Wealth")).toBeInTheDocument()
    expect(screen.getByText("Invest")).toBeInTheDocument()
    expect(screen.getByText("Independence")).toBeInTheDocument()
  })
})
