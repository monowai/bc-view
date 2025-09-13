import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import Portfolios from "@pages/portfolios"
import useSWR from "swr"
import { beforeEach, describe, it } from "@jest/globals"
import { portfolioResult } from "__mocks__/fixtures"

// Mock useSWR with specific data setup
jest.mock("swr", () => ({
  __esModule: true, // This property makes Jest treat it like an ES module
  default: jest.fn(), // This ensures the default export is a mock function
}))

// Setup the mock data for useSWR as needed before each test

describe("Portfolios Page", () => {
  beforeEach(() => {
    const mockUseSWR = jest.fn().mockReturnValue({
      data: portfolioResult,
      error: null,
      mutate: jest.fn(),
    })
    ;(useSWR as jest.Mock).mockImplementation(() => mockUseSWR())
  })

  it("renders the portfolios table when data is available", () => {
    render(<Portfolios />)
    expect(screen.getByText("portfolio.code")).toBeInTheDocument()
    expect(screen.getByText("P123")).toBeInTheDocument()
    expect(screen.getByText("Portfolio 1")).toBeInTheDocument()
    expect(
      screen.getByText((content, element) => {
        return element?.textContent === "$USD"
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByText((content, element) => {
        return element?.textContent === "€EUR"
      }),
    ).toBeInTheDocument()
  })

  it("handles no portfolios correctly", () => {
    const mockUseSWR = jest.fn().mockReturnValue({
      data: { data: [] },
      error: null,
      mutate: jest.fn(),
    })
    ;(useSWR as jest.Mock).mockImplementation(() => mockUseSWR())
    render(<Portfolios />)

    expect(screen.getByText("error.portfolios.empty")).toBeInTheDocument()
  })
})
