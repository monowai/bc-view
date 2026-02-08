import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import Portfolios from "@pages/portfolios"
import useSWR from "swr"
import { beforeEach, afterEach, describe, it } from "@jest/globals"
import { portfolioResult, mockUserProfile } from "../../__fixtures__/fixtures"

// Cast to any since withPageAuthRequired HOC strips prop types in v4
const PortfoliosPage = Portfolios as React.ComponentType<any>

// Mock useSWR with specific data setup
jest.mock("swr", () => ({
  __esModule: true, // This property makes Jest treat it like an ES module
  default: jest.fn(), // This ensures the default export is a mock function
}))

// Setup the mock data for useSWR as needed before each test

// Mock fetch for /api/currencies
const mockFetch = jest.fn()
global.fetch = mockFetch

describe("Portfolios Page", () => {
  beforeEach(() => {
    // Mock fetch to respond based on URL
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/currencies") {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              data: [{ code: "USD", name: "Dollar", symbol: "$" }],
            }),
        })
      }
      // Default for any other fetch (e.g. /api/fx)
      return Promise.resolve({
        json: () => Promise.resolve({ data: {} }),
      })
    })

    const mockUseSWR = jest.fn().mockReturnValue({
      data: portfolioResult,
      error: null,
      mutate: jest.fn(),
    })
    ;(useSWR as jest.Mock).mockImplementation(() => mockUseSWR())
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("renders the portfolios table when data is available", async () => {
    render(<PortfoliosPage user={mockUserProfile} />)

    // Wait for portfolio table to render (requires currencies + FX rates to load)
    await waitFor(() => {
      expect(screen.getByText("portfolio.code")).toBeInTheDocument()
    })
    // Page has both mobile and desktop layouts, so P123 appears twice
    expect(screen.getAllByText("P123").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Portfolio 1").length).toBeGreaterThan(0)
    // Base currency symbols appear in both mobile and desktop layouts
    // (Report currency column was removed - we only show base currency now)
    expect(
      screen.getAllByText((content, element) => {
        return (
          element?.textContent === "$USD" || element?.textContent === "$ USD"
        )
      }).length,
    ).toBeGreaterThan(0)
  })

  it("handles no portfolios correctly", async () => {
    const mockUseSWR = jest.fn().mockReturnValue({
      data: { data: [] },
      error: null,
      mutate: jest.fn(),
    })
    ;(useSWR as jest.Mock).mockImplementation(() => mockUseSWR())
    render(<PortfoliosPage user={mockUserProfile} />)

    // Wait for async currency fetch to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    expect(screen.getByText("error.portfolios.empty")).toBeInTheDocument()
  })
})
