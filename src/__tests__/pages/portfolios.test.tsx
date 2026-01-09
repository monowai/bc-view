import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import Portfolios from "@pages/portfolios"
import useSWR from "swr"
import { beforeEach, afterEach, describe, it } from "@jest/globals"
import { portfolioResult } from "../../__fixtures__/fixtures"

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
    // Mock fetch for currencies API
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ data: [] }),
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
    render(<Portfolios />)

    // Wait for async currency fetch to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/currencies")
    })

    expect(screen.getByText("portfolio.code")).toBeInTheDocument()
    // Page has both mobile and desktop layouts, so P123 appears twice
    expect(screen.getAllByText("P123").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Portfolio 1").length).toBeGreaterThan(0)
    // Currency symbols appear in both mobile and desktop layouts
    expect(
      screen.getAllByText((content, element) => {
        return (
          element?.textContent === "$USD" || element?.textContent === "$ USD"
        )
      }).length,
    ).toBeGreaterThan(0)

    expect(
      screen.getAllByText((content, element) => {
        return (
          element?.textContent === "€EUR" || element?.textContent === "€ EUR"
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
    render(<Portfolios />)

    // Wait for async currency fetch to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    expect(screen.getByText("error.portfolios.empty")).toBeInTheDocument()
  })
})
