import React from "react"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSwr from "swr"
import { useRouter } from "next/router"
import type { IndependencePlan } from "types/independence"

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))

// The suite asserts on `replace`; jest.setup.js's router mock is a plain
// function returning a fresh object, so it can't be read back.
jest.mock("next/router", () => ({ useRouter: jest.fn() }))

let mockJourneys: IndependencePlan[] = []
let mockJourneysLoading = false

jest.mock("@hooks/useIndependencePlans", () => ({
  useIndependencePlans: () => ({
    plans: mockJourneys,
    error: undefined,
    isLoading: mockJourneysLoading,
  }),
}))

let mockOnboardingComplete = true

jest.mock("@contexts/RegistrationContext", () => ({
  useRegistration: () => ({
    isChecking: false,
    isRegistered: true,
    isNewlyRegistered: false,
    isOnboardingComplete: mockOnboardingComplete,
    markOnboardingComplete: jest.fn(),
    error: null,
  }),
}))

jest.mock("@components/features/onboarding/OnboardingWizard", () => ({
  __esModule: true,
  default: () => <div data-testid="wizard" />,
}))

import OnboardingPage from "@pages/onboarding/index"

const Page = OnboardingPage as React.ComponentType<Record<string, unknown>>

const mockReplace = jest.fn()

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

function mockPortfolios(count: number, isLoading = false): void {
  ;(useSwr as jest.Mock).mockImplementation(() => ({
    data: isLoading
      ? undefined
      : {
          data: Array.from({ length: count }, (_, i) => ({ id: `pf-${i}` })),
        },
    error: null,
    isLoading,
  }))
}

describe("/onboarding — the completed-user guard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
      push: jest.fn(),
      query: {},
      pathname: "/onboarding",
    })
    mockJourneys = []
    mockJourneysLoading = false
    mockOnboardingComplete = true
  })

  it("bounces a completed user who already has a journey but no portfolio", () => {
    mockJourneys = [makeJourney("jrn-1")]
    mockPortfolios(0)

    render(<Page />)

    expect(mockReplace).toHaveBeenCalledWith("/")
  })

  it("bounces a completed user who has a portfolio", () => {
    mockPortfolios(1)

    render(<Page />)

    expect(mockReplace).toHaveBeenCalledWith("/")
  })

  it("lets a completed user with neither re-run the wizard", () => {
    mockPortfolios(0)

    render(<Page />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("waits for the portfolios request rather than guessing", () => {
    // Symmetry with the journeys branch: an in-flight request is not an
    // answer either way. (SWR reports isLoading false for a null key, so an
    // unregistered user lands in the "no answer, no bounce" case and can't
    // deadlock here.)
    mockPortfolios(1, true)

    render(<Page />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("waits for the journeys request rather than guessing there are none", () => {
    mockJourneysLoading = true
    mockPortfolios(0)

    render(<Page />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("never bounces a user whose onboarding is not marked complete", () => {
    mockOnboardingComplete = false
    mockJourneys = [makeJourney("jrn-1")]
    mockPortfolios(3)

    render(<Page />)

    expect(mockReplace).not.toHaveBeenCalled()
  })
})
