import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import CardView from "../CardView"
import { Holdings, Portfolio, Position } from "types/beancounter"
import { ValueIn } from "@components/features/holdings/GroupByOptions"

// Mock Next.js router (CardView uses useRouter for click navigation)
jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

// Mock Next.js Link
jest.mock("next/link", () => {
  return function Link({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) {
    return <a href={href}>{children}</a>
  }
})

// react-markdown / remark-gfm are pulled in transitively via NewsSentimentPopup
jest.mock("react-markdown", () => {
  return function MockMarkdown({ children }: { children: string }) {
    return <div>{children}</div>
  }
})
jest.mock("remark-gfm", () => () => {})

const usd = { code: "USD", name: "US Dollar", symbol: "$" }

const mockPortfolio: Portfolio = {
  id: "p-1",
  code: "TEST",
  name: "Test Portfolio",
  currency: usd,
  base: usd,
  marketValue: 15000,
  irr: 0.1,
}

const mockPosition = (): Position =>
  ({
    asset: {
      id: "asset-aapl",
      code: "AAPL",
      name: "Apple Inc.",
      assetCategory: { id: "equity", name: "Equity" },
      market: { code: "NASDAQ", currency: usd },
    },
    moneyValues: {
      PORTFOLIO: {
        currency: usd,
        costValue: 10000,
        marketValue: 15000,
        unrealisedGain: 5000,
        realisedGain: 0,
        dividends: 0,
        irr: 0.2,
        roi: 0.5,
        weight: 0.25,
        totalGain: 5000,
        averageCost: 100,
        gainOnDay: 100,
        priceData: {
          close: 150,
          previousClose: 149,
          change: 1,
          changePercent: 0.0067,
          priceDate: "2024-01-15",
        },
      },
    },
    quantityValues: {
      total: 100,
      purchased: 100,
      sold: 0,
      precision: 0,
    },
    dateValues: {
      opened: "2023-01-01",
      last: "2024-01-15",
      closed: null,
      lastDividend: null,
    },
    lastTradeDate: "2024-01-15",
    roi: 0.5,
  }) as unknown as Position

const mockHoldings = (): Holdings =>
  ({
    holdingGroups: {
      Equity: {
        positions: [mockPosition()],
        subTotals: {
          PORTFOLIO: {
            currency: usd,
            marketValue: 15000,
            totalGain: 5000,
            gainOnDay: 100,
            weight: 1,
            irr: 0.2,
            costValue: 10000,
            unrealisedGain: 5000,
            realisedGain: 0,
            dividends: 0,
          },
        },
      },
    },
    currency: usd,
    portfolio: mockPortfolio,
    valueIn: ValueIn.PORTFOLIO,
    viewTotals: {} as never,
    totals: {
      marketValue: 15000,
      purchases: 10000,
      sales: 0,
      cash: 0,
      income: 0,
      gain: 5000,
      irr: 0.2,
      currency: usd,
    },
  }) as unknown as Holdings

describe("CardView footer (Quantity / Price / Weight)", () => {
  it("renders quantity, price, and weight values with their labels", () => {
    render(
      <CardView
        holdings={mockHoldings()}
        portfolio={mockPortfolio}
        valueIn={ValueIn.PORTFOLIO}
      />,
    )

    // Labels
    expect(screen.getByText("Quantity")).toBeInTheDocument()
    expect(screen.getByText("Price")).toBeInTheDocument()
    expect(screen.getByText("Weight")).toBeInTheDocument()

    // Values: quantity=100, price=$150.00, weight=25.00%
    expect(screen.getByText("100")).toBeInTheDocument()
    expect(screen.getByText("$150.00")).toBeInTheDocument()
    // Weight renders "25.00" inside a span followed by a sibling "%" text node
    const weightLabel = screen.getByText("Weight")
    expect(weightLabel.parentElement).toHaveTextContent("25.00%")
  })
})
