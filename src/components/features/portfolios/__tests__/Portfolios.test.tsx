import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { Portfolios } from "../Portfolios"
import { Portfolio } from "types/beancounter"

// Mock next-i18next
jest.mock("next-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    ready: true,
  }),
}))

// Mock next/router
const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock SWR
jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
}))

// Mock rootLoader
jest.mock("@components/ui/PageLoader", () => ({
  rootLoader: (text: string) => <div data-testid="loading">{text}</div>,
}))

import useSwr from "swr"

const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

const mockPortfolio: Portfolio = {
  id: "test-portfolio",
  code: "TEST",
  name: "Test Portfolio",
  currency: { code: "USD", name: "US Dollar", symbol: "$" },
  base: { code: "USD", name: "US Dollar", symbol: "$" },
  marketValue: 10000,
  irr: 0.1,
}

const mockPortfolios = [
  mockPortfolio,
  {
    id: "another-portfolio",
    code: "ANOTHER",
    name: "Another Portfolio",
    currency: { code: "USD", name: "US Dollar", symbol: "$" },
    base: { code: "USD", name: "US Dollar", symbol: "$" },
    marketValue: 20000,
    irr: 0.15,
  },
]

describe("Portfolios Component (TDD)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Loading State", () => {
    it("should display selected portfolio name immediately, even while portfolios list is loading", () => {
      // Setup: SWR is still loading (data is undefined)
      mockUseSwr.mockReturnValue({
        data: undefined,
        error: undefined,
        isLoading: true,
        isValidating: false,
        mutate: jest.fn(),
      } as any)

      render(<Portfolios {...mockPortfolio} />)

      // Expected behavior: Should show the selected portfolio name, not "Loading..."
      // The user already knows which portfolio they're viewing, so we should display it
      expect(screen.getByText("Test Portfolio")).toBeInTheDocument()
      expect(screen.queryByTestId("loading")).not.toBeInTheDocument()
    })

    it("should update selected portfolio when prop changes from Loading to real portfolio", () => {
      mockUseSwr.mockReturnValue({
        data: undefined,
        error: undefined,
        isLoading: true,
        isValidating: false,
        mutate: jest.fn(),
      } as any)

      const loadingPortfolio = {
        ...mockPortfolio,
        name: "Loading...",
      }

      const { rerender } = render(<Portfolios {...loadingPortfolio} />)

      // Initially shows "Loading..."
      expect(screen.getByText("Loading...")).toBeInTheDocument()

      // Now update with real portfolio
      rerender(<Portfolios {...mockPortfolio} />)

      // Should now show the real portfolio name
      expect(screen.getByText("Test Portfolio")).toBeInTheDocument()
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })
  })

  describe("Loaded State", () => {
    beforeEach(() => {
      mockUseSwr.mockReturnValue({
        data: { data: mockPortfolios },
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: jest.fn(),
      } as any)
    })

    it("should display the selected portfolio name when data is loaded", () => {
      render(<Portfolios {...mockPortfolio} />)

      expect(screen.getByText("Test Portfolio")).toBeInTheDocument()
    })

    it("should display dropdown with all portfolios when clicked", async () => {
      render(<Portfolios {...mockPortfolio} />)

      const button = screen.getByRole("button", { name: /Test Portfolio/i })
      button.click()

      await waitFor(() => {
        expect(screen.getByText("Another Portfolio")).toBeInTheDocument()
      })
    })
  })
})
