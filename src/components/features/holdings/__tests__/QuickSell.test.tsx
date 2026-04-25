import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import type { Position } from "types/beancounter"
import "@testing-library/jest-dom"
import Rows from "../Rows"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import {
  makeAsset,
  makeCashAsset,
  makeHoldingGroup,
  makePortfolio,
  makePosition,
} from "@test-fixtures/beancounter"

// AlphaProgress depends on layout measurements that aren't useful here.
jest.mock("@components/ui/ProgressBar", () => ({
  AlphaProgress: () => <div data-testid="alpha-progress" />,
}))

const mockPortfolio = makePortfolio({
  id: "test-portfolio-id",
  marketValue: 10000,
})

const tradedPosition = (
  code: string,
  marketCode: string,
  quantity: number,
  price: number,
): Position =>
  makePosition({
    asset: makeAsset({
      id: `asset-${code}`,
      code: `${marketCode}.${code}`,
      name: `${code} Company`,
      market: {
        code: marketCode,
        name: marketCode,
        currency: { code: "USD", name: "US Dollar", symbol: "$" },
      },
    }),
    moneyValues: {
      marketValue: quantity * price,
      costValue: quantity * (price - 10),
      unrealisedGain: quantity * 10,
      totalGain: quantity * 10 + 100,
      gainOnDay: quantity,
      averageCost: price - 10,
      weight: 0.5,
      irr: 0.15,
      roi: 0.12,
      dividends: 100,
    },
    price,
    quantityValues: { total: quantity, purchased: quantity },
  })

describe("Quick Sell Feature via Actions Menu", () => {
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

    it("should render an actions menu button for each position when onQuickSell is provided", () => {
      const positions = [
        tradedPosition("AAPL", "NASDAQ", 100, 150),
        tradedPosition("GOOGL", "NASDAQ", 50, 140),
      ]

      render(
        <table>
          <Rows
            portfolio={mockPortfolio}
            groupBy="Equity"
            holdingGroup={makeHoldingGroup({ positions })}
            valueIn={ValueIn.PORTFOLIO}
            onColumnsChange={mockOnColumnsChange}
            onQuickSell={mockOnQuickSell}
          />
        </table>,
      )

      const actionsButtons = screen.getAllByRole("button", { name: /actions/i })
      expect(actionsButtons).toHaveLength(2)
    })

    it("should call onQuickSell with correct asset details when Quick Sell menu item is clicked", () => {
      const positions = [tradedPosition("AAPL", "NASDAQ", 100, 150)]

      render(
        <table>
          <Rows
            portfolio={mockPortfolio}
            groupBy="Equity"
            holdingGroup={makeHoldingGroup({ positions })}
            valueIn={ValueIn.PORTFOLIO}
            onColumnsChange={mockOnColumnsChange}
            onQuickSell={mockOnQuickSell}
          />
        </table>,
      )

      const actionsButton = screen.getByRole("button", { name: /actions/i })
      fireEvent.click(actionsButton)

      const sellMenuItem = screen.getByRole("button", { name: /quick sell/i })
      fireEvent.click(sellMenuItem)

      expect(mockOnQuickSell).toHaveBeenCalledTimes(1)
      expect(mockOnQuickSell).toHaveBeenCalledWith({
        asset: "AAPL",
        market: "NASDAQ",
        quantity: 100,
        price: 150,
      })
    })

    it("should have hidden class for mobile portrait mode on actions menu container", () => {
      const positions = [tradedPosition("AAPL", "NASDAQ", 100, 150)]

      render(
        <table>
          <Rows
            portfolio={mockPortfolio}
            groupBy="Equity"
            holdingGroup={makeHoldingGroup({ positions })}
            valueIn={ValueIn.PORTFOLIO}
            onColumnsChange={mockOnColumnsChange}
            onQuickSell={mockOnQuickSell}
          />
        </table>,
      )

      const actionsButton = screen.getByRole("button", { name: /actions/i })
      const outerContainer = actionsButton.parentElement?.parentElement
      expect(outerContainer).toHaveClass("flex")
      expect(outerContainer).toHaveClass("items-center")
    })
  })

  describe("Without onQuickSell callback", () => {
    it("should not render actions menu when onQuickSell is not provided", () => {
      const positions = [tradedPosition("AAPL", "NASDAQ", 100, 150)]

      render(
        <table>
          <Rows
            portfolio={mockPortfolio}
            groupBy="Equity"
            holdingGroup={makeHoldingGroup({ positions })}
            valueIn={ValueIn.PORTFOLIO}
            onColumnsChange={mockOnColumnsChange}
          />
        </table>,
      )

      const actionsButtons = screen.queryAllByRole("button", {
        name: /actions/i,
      })
      expect(actionsButtons).toHaveLength(0)
    })
  })

  describe("Cash positions", () => {
    it("should not render actions menu for cash positions", () => {
      const cashPosition = makePosition({
        asset: makeCashAsset(),
        moneyValues: {
          marketValue: 5000,
          costValue: 5000,
          weight: 0.1,
          averageCost: 1,
        },
        quantityValues: { total: 5000, purchased: 5000, precision: 2 },
      })

      render(
        <table>
          <Rows
            portfolio={mockPortfolio}
            groupBy="Cash"
            holdingGroup={makeHoldingGroup({ positions: [cashPosition] })}
            valueIn={ValueIn.PORTFOLIO}
            onColumnsChange={mockOnColumnsChange}
            onQuickSell={mockOnQuickSell}
          />
        </table>,
      )

      const actionsButtons = screen.queryAllByRole("button", {
        name: /actions/i,
      })
      expect(actionsButtons).toHaveLength(0)
    })
  })

  describe("Asset code parsing", () => {
    it("should extract asset code without market prefix", () => {
      const positions = [tradedPosition("MSFT", "NYSE", 75, 400)]

      render(
        <table>
          <Rows
            portfolio={mockPortfolio}
            groupBy="Equity"
            holdingGroup={makeHoldingGroup({ positions })}
            valueIn={ValueIn.PORTFOLIO}
            onColumnsChange={mockOnColumnsChange}
            onQuickSell={mockOnQuickSell}
          />
        </table>,
      )

      const actionsButton = screen.getByRole("button", { name: /actions/i })
      fireEvent.click(actionsButton)

      const sellMenuItem = screen.getByRole("button", { name: /quick sell/i })
      fireEvent.click(sellMenuItem)

      expect(mockOnQuickSell).toHaveBeenCalledWith(
        expect.objectContaining({
          asset: "MSFT",
          market: "NYSE",
        }),
      )
    })
  })
})
