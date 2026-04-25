import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import NewsPage from "@pages/news"

// react-markdown / remark-gfm mocked globally in jest.setup.js

const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({ pathname: "/news", query: {}, push: mockPush }),
}))

import { makePortfolio, NZD, USD } from "@test-fixtures/beancounter"

const mockPortfolios = [
  makePortfolio({
    id: "p1",
    code: "TEST",
    name: "Test Portfolio",
    currency: USD,
    base: USD,
    marketValue: 10000,
    irr: 0.05,
  }),
  makePortfolio({
    id: "p2",
    code: "NZD",
    name: "NZ Portfolio",
    currency: NZD,
    base: NZD,
    marketValue: 5000,
    irr: 0.03,
  }),
]

jest.mock("@hooks/usePortfolios", () => ({
  usePortfolios: () => ({
    portfolios: mockPortfolios,
    isLoading: false,
    error: undefined,
  }),
}))

// Mock SWR for holdings
const mockHoldingsData = {
  data: {
    positions: {
      pos1: {
        asset: {
          id: "a1",
          code: "AAPL",
          name: "Apple",
          assetCategory: { id: "EQUITY", name: "EQUITY" },
          market: {
            code: "NASDAQ",
            name: "NASDAQ",
            currency: { code: "USD", symbol: "$", name: "US Dollar" },
          },
        },
      },
      pos2: {
        asset: {
          id: "a2",
          code: "VOO",
          name: "Vanguard S&P 500",
          assetCategory: { id: "ETF", name: "ETF" },
          market: {
            code: "NYSE",
            name: "NYSE",
            currency: { code: "USD", symbol: "$", name: "US Dollar" },
          },
        },
      },
      pos3: {
        asset: {
          id: "a3",
          code: "USD",
          name: "US Dollar",
          assetCategory: { id: "CASH", name: "CASH" },
          market: {
            code: "CASH",
            name: "CASH",
            currency: { code: "USD", symbol: "$", name: "US Dollar" },
          },
        },
      },
    },
  },
}

jest.mock("swr", () => ({
  __esModule: true,
  default: () => ({
    data: mockHoldingsData,
    error: undefined,
    isLoading: false,
  }),
}))

// Mock fetch for useChat
global.fetch = jest.fn()

// Mock Auth0
jest.mock("@auth0/nextjs-auth0/client", () => ({
  withPageAuthRequired: (component: React.ComponentType) => component,
  useUser: () => ({ user: { sub: "test" } }),
}))

describe("NewsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the page title", () => {
    render(<NewsPage />)
    expect(screen.getByText("News & Sentiment")).toBeInTheDocument()
  })

  it("renders the portfolio selector", () => {
    render(<NewsPage />)
    const select = screen.getByRole("combobox")
    expect(select).toBeInTheDocument()
  })

  it("shows portfolio options in the selector", () => {
    render(<NewsPage />)
    expect(screen.getByText("TEST — Test Portfolio")).toBeInTheDocument()
    expect(screen.getByText("NZD — NZ Portfolio")).toBeInTheDocument()
  })

  it("displays ticker chips for market assets", () => {
    render(<NewsPage />)
    expect(screen.getByText("AAPL")).toBeInTheDocument()
    expect(screen.getByText("VOO")).toBeInTheDocument()
  })

  it("does not display CASH tickers", () => {
    render(<NewsPage />)
    // USD is a CASH position, should not appear as a ticker chip
    const chips = screen.getAllByTestId("ticker-chip")
    const chipTexts = chips.map((c) => c.textContent)
    expect(chipTexts).not.toContain("USD")
  })

  it("renders the chat panel", () => {
    render(<NewsPage />)
    expect(screen.getByText("Holdsworth Assistant")).toBeInTheDocument()
  })

  it("shows suggestions in chat panel", () => {
    render(<NewsPage />)
    expect(
      screen.getByText("What's the sentiment on my holdings?"),
    ).toBeInTheDocument()
  })

  it("changes portfolio on select", () => {
    render(<NewsPage />)
    const select = screen.getByRole("combobox")
    fireEvent.change(select, { target: { value: "NZD" } })
    expect((select as HTMLSelectElement).value).toBe("NZD")
  })
})
