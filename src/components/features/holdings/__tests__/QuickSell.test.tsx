import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import Rows from "../Rows"
import { Position, Portfolio, HoldingGroup } from "types/beancounter"
import { ValueIn } from "@components/features/holdings/GroupByOptions"

// Mock Next.js Link component
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

// Mock dependencies
jest.mock("@components/ui/ProgressBar", () => ({
  AlphaProgress: () => <div data-testid="alpha-progress" />,
}))

const mockPortfolio: Portfolio = {
  id: "test-portfolio-id",
  code: "TEST",
  name: "Test Portfolio",
  currency: { code: "USD", name: "US Dollar", symbol: "$" },
  base: { code: "USD", name: "US Dollar", symbol: "$" },
  marketValue: 10000,
  irr: 0.1,
}

const createMockPosition = (
  code: string,
  marketCode: string,
  quantity: number,
  price: number
): Position =>
  ({
  asset: {
    id: `asset-${code}`,
    code: `${marketCode}.${code}`,
    name: `${code} Company`,
    assetCategory: { id: "equity", name: "Equity" },
    market: {
      code: marketCode,
      currency: { code: "USD", name: "US Dollar", symbol: "$" },
    },
  },
  moneyValues: {
    PORTFOLIO: {
      currency: { code: "USD", name: "US Dollar", symbol: "$" },
      costValue: quantity * (price - 10),
      marketValue: quantity * price,
      unrealisedGain: quantity * 10,
      realisedGain: 0,
      dividends: 100,
      irr: 0.15,
      roi: 0.12,
      weight: 0.5,
      totalGain: quantity * 10 + 100,
      averageCost: price - 10,
      priceData: {
        close: price,
        previousClose: price - 1,
        change: 1,
        changePercent: 0.01,
        priceDate: "2024-01-15",
      },
      gainOnDay: quantity,
    },
  },
  quantityValues: {
    total: quantity,
    purchased: quantity,
    sold: 0,
    precision: 0,
  },
  dateValues: {
    opened: "2023-01-01",
    last: "2024-01-15",
    closed: null,
    lastDividend: "2024-01-01",
  },
  lastTradeDate: "2024-01-15",
  roi: 0.12,
}) as Position

const createMockHoldingGroup = (positions: Position[]): HoldingGroup => ({
  positions,
  subTotals: {
    PORTFOLIO: {
      marketValue: 50000,
      costValue: 40000,
      unrealisedGain: 10000,
      realisedGain: 0,
      dividends: 500,
      weight: 1,
      totalGain: 10500,
      irr: 0.15,
      currency: { code: "USD", name: "US Dollar", symbol: "$" },
    },
  },
})

describe("Quick Sell Icon Feature", () => {
  const mockOnColumnsChange = jest.fn()
  const mockOnQuickSell = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Desktop/Tablet Mode", () => {
    beforeEach(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      })
    })

    it("should render a sell icon button for each position when onQuickSell is provided", () => {
      const positions = [
        createMockPosition("AAPL", "NASDAQ", 100, 150),
        createMockPosition("GOOGL", "NASDAQ", 50, 140),
      ]

      render(
        <table>
          <Rows
            portfolio={mockPortfolio}
            groupBy="Equity"
            holdingGroup={createMockHoldingGroup(positions)}
            valueIn={ValueIn.PORTFOLIO}
            onColumnsChange={mockOnColumnsChange}
            onQuickSell={mockOnQuickSell}
          />
        </table>
      )

      const sellButtons = screen.getAllByRole("button", { name: /sell/i })
      expect(sellButtons).toHaveLength(2)
    })

    it("should call onQuickSell with correct asset details when sell icon is clicked", () => {
      const positions = [createMockPosition("AAPL", "NASDAQ", 100, 150)]

      render(
        <table>
          <Rows
            portfolio={mockPortfolio}
            groupBy="Equity"
            holdingGroup={createMockHoldingGroup(positions)}
            valueIn={ValueIn.PORTFOLIO}
            onColumnsChange={mockOnColumnsChange}
            onQuickSell={mockOnQuickSell}
          />
        </table>
      )

      const sellButton = screen.getByRole("button", { name: /sell/i })
      fireEvent.click(sellButton)

      expect(mockOnQuickSell).toHaveBeenCalledTimes(1)
      expect(mockOnQuickSell).toHaveBeenCalledWith({
        asset: "AAPL",
        market: "NASDAQ",
        quantity: 100,
        price: 150,
      })
    })

    it("should have hidden class for mobile portrait mode on sell button", () => {
      const positions = [createMockPosition("AAPL", "NASDAQ", 100, 150)]

      render(
        <table>
          <Rows
            portfolio={mockPortfolio}
            groupBy="Equity"
            holdingGroup={createMockHoldingGroup(positions)}
            valueIn={ValueIn.PORTFOLIO}
            onColumnsChange={mockOnColumnsChange}
            onQuickSell={mockOnQuickSell}
          />
        </table>
      )

      const sellButton = screen.getByRole("button", { name: /sell/i })
      // Should be hidden on mobile portrait but visible on desktop/tablet
      expect(sellButton).toHaveClass("hidden")
      expect(sellButton).toHaveClass("sm:inline-flex")
    })
  })

  describe("Without onQuickSell callback", () => {
    it("should not render sell icon when onQuickSell is not provided", () => {
      const positions = [createMockPosition("AAPL", "NASDAQ", 100, 150)]

      render(
        <table>
          <Rows
            portfolio={mockPortfolio}
            groupBy="Equity"
            holdingGroup={createMockHoldingGroup(positions)}
            valueIn={ValueIn.PORTFOLIO}
            onColumnsChange={mockOnColumnsChange}
          />
        </table>
      )

      const sellButtons = screen.queryAllByRole("button", { name: /sell/i })
      expect(sellButtons).toHaveLength(0)
    })
  })

  describe("Cash positions", () => {
    it("should not render sell icon for cash positions", () => {
      const cashPosition = {
        asset: {
          id: "cash-usd",
          code: "USD",
          name: "US Dollar",
          assetCategory: { id: "CASH", name: "Cash" },
          market: {
            code: "CASH",
            currency: { code: "USD", name: "US Dollar", symbol: "$" },
          },
        },
        moneyValues: {
          PORTFOLIO: {
            currency: { code: "USD", name: "US Dollar", symbol: "$" },
            costValue: 5000,
            marketValue: 5000,
            unrealisedGain: 0,
            realisedGain: 0,
            dividends: 0,
            irr: 0,
            roi: 0,
            weight: 0.1,
            totalGain: 0,
            averageCost: 1,
            priceData: undefined,
            gainOnDay: 0,
          },
        },
        quantityValues: {
          total: 5000,
          purchased: 5000,
          sold: 0,
          precision: 2,
        },
        dateValues: {
          opened: "2023-01-01",
          last: "2024-01-15",
          closed: null,
          lastDividend: null,
        },
        lastTradeDate: "2024-01-15",
        roi: 0,
      } as Position

      render(
        <table>
          <Rows
            portfolio={mockPortfolio}
            groupBy="Cash"
            holdingGroup={createMockHoldingGroup([cashPosition])}
            valueIn={ValueIn.PORTFOLIO}
            onColumnsChange={mockOnColumnsChange}
            onQuickSell={mockOnQuickSell}
          />
        </table>
      )

      const sellButtons = screen.queryAllByRole("button", { name: /sell/i })
      expect(sellButtons).toHaveLength(0)
    })
  })

  describe("Asset code parsing", () => {
    it("should extract asset code without market prefix", () => {
      const positions = [createMockPosition("MSFT", "NYSE", 75, 400)]

      render(
        <table>
          <Rows
            portfolio={mockPortfolio}
            groupBy="Equity"
            holdingGroup={createMockHoldingGroup(positions)}
            valueIn={ValueIn.PORTFOLIO}
            onColumnsChange={mockOnColumnsChange}
            onQuickSell={mockOnQuickSell}
          />
        </table>
      )

      const sellButton = screen.getByRole("button", { name: /sell/i })
      fireEvent.click(sellButton)

      expect(mockOnQuickSell).toHaveBeenCalledWith(
        expect.objectContaining({
          asset: "MSFT",
          market: "NYSE",
        })
      )
    })
  })
})
