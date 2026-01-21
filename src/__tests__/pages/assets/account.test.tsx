import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import CreateAccount from "@pages/assets/account"
import useSWR from "swr"
import { beforeEach, describe, it } from "@jest/globals"

// Mock useSWR
jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
}))

// Mock next/router
jest.mock("next/router", () => ({
  useRouter: () => ({
    query: {},
    push: jest.fn(),
  }),
}))

// Mock useUserPreferences
jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({
    preferences: { reportingCurrencyCode: "NZD" },
    isLoading: false,
  }),
}))

const currencyData = {
  data: [
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "NZD", name: "New Zealand Dollar", symbol: "$" },
    { code: "SGD", name: "Singapore Dollar", symbol: "$" },
  ],
}

describe("Create Account Page", () => {
  beforeEach(() => {
    const mockUseSWR = jest.fn().mockReturnValue({
      data: currencyData,
      error: null,
      isLoading: false,
    })
    ;(useSWR as jest.Mock).mockImplementation(() => mockUseSWR())
  })

  it("renders the account form with all fields", () => {
    render(<CreateAccount />)

    expect(screen.getByText("account.create")).toBeInTheDocument()
    expect(screen.getByText("account.code")).toBeInTheDocument()
    expect(screen.getByText("account.name")).toBeInTheDocument()
    expect(screen.getByText("account.currency")).toBeInTheDocument()
  })

  it("renders submit and cancel buttons", () => {
    render(<CreateAccount />)

    expect(screen.getByText("form.submit")).toBeInTheDocument()
    expect(screen.getByText("form.cancel")).toBeInTheDocument()
  })

  it("shows loading state while currencies are loading", () => {
    const mockUseSWR = jest.fn().mockReturnValue({
      data: null,
      error: null,
      isLoading: true,
    })
    ;(useSWR as jest.Mock).mockImplementation(() => mockUseSWR())

    render(<CreateAccount />)

    expect(screen.getByText("loading")).toBeInTheDocument()
  })
})
