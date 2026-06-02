import React from "react"
import { render, screen } from "@testing-library/react"
import HeaderUserControls from "../HeaderUserControls"
import { useUser } from "@auth0/nextjs-auth0/client"

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({
    preferences: { preferredName: "Test User" },
    isLoading: false,
    error: null,
  }),
}))

jest.mock("@hooks/useIsAdmin", () => ({
  useIsAdmin: () => ({ isAdmin: false, isLoading: false }),
}))

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false, toggleHideValues: jest.fn() }),
}))

describe("HeaderUserControls", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders styled Sign In button when not authenticated", () => {
    mockUseUser.mockReturnValueOnce({
      user: undefined,
      error: undefined,
      isLoading: false,
      invalidate: jest.fn(),
    } as unknown as ReturnType<typeof useUser>)

    render(<HeaderUserControls />)
    const cta = screen.getByRole("link", { name: /Sign In/i })
    expect(cta).toHaveAttribute("href", "/auth/login")
    // Privacy toggle hidden when unauth
    expect(
      screen.queryByRole("button", { name: /Hide values|Show values/i }),
    ).not.toBeInTheDocument()
  })
})
