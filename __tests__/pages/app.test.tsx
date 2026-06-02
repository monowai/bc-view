import Home from "@pages/index"
import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { registrationSuccess, portfolioResult } from "../fixtures"
import { enableFetchMocks } from "jest-fetch-mock"
import simpleGit from "../../__mocks__/simple-git"
import { useUser } from "@auth0/nextjs-auth0/client"

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>

enableFetchMocks()

// Mock RegistrationContext to return registered state immediately
jest.mock("../../src/contexts/RegistrationContext", () => ({
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
jest.mock("../../src/contexts/UserPreferencesContext", () => ({
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
      expect(screen.getByText("Welcome!")).toBeInTheDocument()
    })

    // Check for the three domain cards on the landing page
    expect(screen.getByText("Manage Wealth")).toBeInTheDocument()
    expect(screen.getByText("Plan Independence")).toBeInTheDocument()
    expect(screen.getByText("Investment Strategy")).toBeInTheDocument()

    // Auth'd cards point to functional routes
    expect(
      screen.getByRole("link", { name: /View Net Worth/i }),
    ).toHaveAttribute("href", "/wealth")
    expect(
      screen.getByRole("link", { name: /Independence Plans/i }),
    ).toHaveAttribute("href", "/independence")
    expect(screen.getByRole("link", { name: /View Models/i })).toHaveAttribute(
      "href",
      "/rebalance/models",
    )
  })

  test("renders unauth landing with Sign In CTA when no user", async () => {
    mockUseUser.mockReturnValue({
      user: undefined,
      error: undefined,
      isLoading: false,
      invalidate: jest.fn(),
    } as unknown as ReturnType<typeof useUser>)

    render(<Home />)

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Welcome\./i }),
      ).toBeInTheDocument()
    })
    expect(screen.getByText(/Login or Signup/i)).toBeInTheDocument()

    const signIn = screen.getByRole("link", { name: /Sign In/i })
    expect(signIn).toHaveAttribute("href", "/auth/login")

    // Cards still rendered, but pointing to marketing routes
    expect(
      screen.getByRole("link", { name: /Manage Wealth/i }),
    ).toHaveAttribute("href", "/learn/wealth")
    expect(
      screen.getByRole("link", { name: /Plan Independence/i }),
    ).toHaveAttribute("href", "/learn/independence")
    expect(
      screen.getByRole("link", { name: /Investment Strategy/i }),
    ).toHaveAttribute("href", "/learn/strategy")

    // No portfolio "Getting Started" prompt for unauth
    expect(screen.queryByText(/Let's Get You Started/i)).not.toBeInTheDocument()
  })
})
