import React from "react"
import { render, screen } from "@testing-library/react"
import { enableFetchMocks } from "jest-fetch-mock"

enableFetchMocks()

jest.mock("../../../src/contexts/UserPreferencesContext", () => ({
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

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

describe("/independence/setup", () => {
  beforeEach(() => {
    fetchMock.resetMocks()
    fetchMock.mockResponse(JSON.stringify({ data: {} }))
  })

  test("renders profile, work and objectives sections", async () => {
    const { default: Setup } =
      await import("../../../src/pages/independence/setup")
    render(<Setup />)

    expect(
      screen.getByText(/set up your independence plan/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/independence settings/i)).toBeInTheDocument()
    expect(screen.getByText(/my work scenario/i)).toBeInTheDocument()
  })

  test("shows date of birth and target age inputs", async () => {
    const { default: Setup } =
      await import("../../../src/pages/independence/setup")
    render(<Setup />)

    expect(
      screen.getByRole("spinbutton", { name: /year of birth/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("spinbutton", { name: /target independence age/i }),
    ).toBeInTheDocument()
  })

  test("shows work plan income field", async () => {
    const { default: Setup } =
      await import("../../../src/pages/independence/setup")
    render(<Setup />)

    expect(
      screen.getByRole("spinbutton", { name: /monthly income/i }),
    ).toBeInTheDocument()
  })
})
