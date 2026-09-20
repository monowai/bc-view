import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSwr from "swr"
import { useRouter } from "next/router"

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))

// jest.setup.js's router mock returns a fresh object from a plain function —
// this suite asserts on `replace`, so it needs a spy it can read back.
jest.mock("next/router", () => ({ useRouter: jest.fn() }))

// Registration state is the whole point of these tests, so it's per-test.
let mockRegistration = {
  isChecking: false,
  isRegistered: true,
  isNewlyRegistered: false,
  isOnboardingComplete: false,
  markOnboardingComplete: jest.fn(),
  error: null as string | null,
}

jest.mock("@contexts/RegistrationContext", () => ({
  useRegistration: () => mockRegistration,
}))

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({
    preferences: { preferredName: "Sam" },
    isLoading: false,
  }),
}))

jest.mock("@contexts/MilestonesContext", () => ({
  useMilestones: () => ({ milestones: [], mode: "OFF" }),
}))

jest.mock("@components/features/landing/MarketingLanding", () => ({
  __esModule: true,
  default: () => <div data-testid="marketing" />,
}))

import Home from "@pages/index"

const mockReplace = jest.fn()

/** Only the portfolios key matters here; everything else stays empty. */
function mockPortfolios(count: number | undefined): void {
  ;(useSwr as jest.Mock).mockImplementation(() => ({
    data:
      count === undefined
        ? undefined
        : {
            data: Array.from({ length: count }, (_, i) => ({ id: `pf-${i}` })),
          },
    error: null,
    isLoading: false,
  }))
}

describe("/ — routing a newly registered account into onboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
      push: jest.fn(),
      query: {},
      pathname: "/",
    })
    mockRegistration = {
      isChecking: false,
      isRegistered: true,
      isNewlyRegistered: false,
      isOnboardingComplete: false,
      markOnboardingComplete: jest.fn(),
      error: null,
    }
  })

  it("sends a brand-new account with no portfolios to /onboarding", () => {
    mockRegistration.isNewlyRegistered = true
    mockPortfolios(0)

    render(<Home />)

    expect(mockReplace).toHaveBeenCalledWith("/onboarding")
  })

  it("leaves a returning user on the home page", () => {
    mockRegistration.isNewlyRegistered = false
    mockPortfolios(0)

    render(<Home />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("leaves a newly registered user who already owns a portfolio", () => {
    mockRegistration.isNewlyRegistered = true
    mockPortfolios(2)

    render(<Home />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("leaves a newly registered user whose onboarding is already complete", () => {
    mockRegistration.isNewlyRegistered = true
    mockRegistration.isOnboardingComplete = true
    mockPortfolios(0)

    render(<Home />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("waits for the portfolios request rather than guessing", () => {
    mockRegistration.isNewlyRegistered = true
    mockPortfolios(undefined)

    render(<Home />)

    expect(mockReplace).not.toHaveBeenCalled()
  })
})

describe("/ — the getting started card", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
      push: jest.fn(),
      query: {},
      pathname: "/",
    })
    mockRegistration = {
      isChecking: false,
      isRegistered: true,
      isNewlyRegistered: false,
      isOnboardingComplete: false,
      markOnboardingComplete: jest.fn(),
      error: null,
    }
  })

  it("offers independence alongside setup, brokerage and add", () => {
    mockPortfolios(0)

    render(<Home />)

    expect(
      screen.getByRole("link", { name: /plan your independence/i }),
    ).toHaveAttribute("href", "/independence")
    expect(screen.getByRole("link", { name: /start setup/i })).toHaveAttribute(
      "href",
      "/onboarding",
    )
  })
})
