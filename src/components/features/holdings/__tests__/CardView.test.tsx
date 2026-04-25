import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import CardView from "../CardView"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import {
  makeAsset,
  makeHoldingGroup,
  makeHoldings,
  makePortfolio,
  makePosition,
} from "@test-fixtures/beancounter"

jest.mock("@hooks/usePrivacyMode")

const mockedUsePrivacyMode = usePrivacyMode as jest.MockedFunction<
  typeof usePrivacyMode
>

const renderWithFooter = (): void => {
  const portfolio = makePortfolio()
  const position = makePosition({
    moneyValues: { weight: 0.25 },
    price: 150,
    quantityValues: { total: 100 },
  })
  const holdings = makeHoldings({
    portfolio,
    holdingGroups: { Equity: makeHoldingGroup({ positions: [position] }) },
  })
  render(
    <CardView
      holdings={holdings}
      portfolio={portfolio}
      valueIn={ValueIn.PORTFOLIO}
    />,
  )
}

describe("CardView footer (Quantity / Price / Weight)", () => {
  beforeEach(() => {
    mockedUsePrivacyMode.mockReturnValue({
      hideValues: false,
      toggleHideValues: jest.fn(),
    })
  })

  it("renders quantity, price, and weight values with their labels", () => {
    renderWithFooter()

    expect(screen.getByText("Quantity")).toBeInTheDocument()
    expect(screen.getByText("Price")).toBeInTheDocument()
    expect(screen.getByText("Weight")).toBeInTheDocument()

    expect(screen.getByText("100")).toBeInTheDocument()
    expect(screen.getByText("$150.00")).toBeInTheDocument()
    const weightLabel = screen.getByText("Weight")
    expect(weightLabel.parentElement).toHaveTextContent("25.00%")
  })

  describe("with privacy mode enabled", () => {
    beforeEach(() => {
      mockedUsePrivacyMode.mockReturnValue({
        hideValues: true,
        toggleHideValues: jest.fn(),
      })
    })

    it("hides private quantity, shows weight (public) and price", () => {
      renderWithFooter()

      // Quantity = private → masked (****), no "100"
      expect(screen.queryByText("100")).not.toBeInTheDocument()
      const quantityLabel = screen.getByText("Quantity")
      expect(quantityLabel.parentElement).toHaveTextContent("****")

      // Weight isPublic → still shown
      const weightLabel = screen.getByText("Weight")
      expect(weightLabel.parentElement).toHaveTextContent("25.00%")

      // Price = literal toFixed string, not gated by privacy in current impl
      expect(screen.getByText("$150.00")).toBeInTheDocument()
    })

    it("masks portfolio summary monetary values", () => {
      renderWithFooter()

      // marketValue + totalGain + gainOnDay all rendered via FormatValue → masked
      // At least one **** in summary card area
      const masked = screen.getAllByText("****")
      expect(masked.length).toBeGreaterThan(0)
    })
  })

  describe("price chart click", () => {
    const renderWithChart = (
      onPriceChart?: jest.Mock,
      categoryId = "EQUITY",
    ): { portfolio: ReturnType<typeof makePortfolio> } => {
      const portfolio = makePortfolio()
      const asset = makeAsset({
        assetCategory: { id: categoryId, name: categoryId },
      })
      const position = makePosition({
        asset,
        moneyValues: { weight: 0.25 },
        price: 150,
        quantityValues: { total: 100 },
      })
      const holdings = makeHoldings({
        portfolio,
        holdingGroups: { Equity: makeHoldingGroup({ positions: [position] }) },
      })
      render(
        <CardView
          holdings={holdings}
          portfolio={portfolio}
          valueIn={ValueIn.PORTFOLIO}
          onPriceChart={onPriceChart}
        />,
      )
      return { portfolio }
    }

    it("renders price as a button and invokes onPriceChart for EQUITY", () => {
      const onPriceChart = jest.fn()
      const { portfolio } = renderWithChart(onPriceChart, "EQUITY")
      const button = screen.getByRole("button", {
        name: /Show price chart for AAPL/i,
      })
      fireEvent.click(button)
      expect(onPriceChart).toHaveBeenCalledWith(
        expect.objectContaining({ portfolioId: portfolio.id }),
      )
    })

    it("does not render a price button when onPriceChart is omitted", () => {
      renderWithChart(undefined, "EQUITY")
      expect(
        screen.queryByRole("button", { name: /Show price chart/i }),
      ).not.toBeInTheDocument()
    })

    it("does not render a price button for non-chartable categories", () => {
      const onPriceChart = jest.fn()
      renderWithChart(onPriceChart, "BOND")
      expect(
        screen.queryByRole("button", { name: /Show price chart/i }),
      ).not.toBeInTheDocument()
    })
  })

  describe("actions menu parity with table view", () => {
    it("invokes onQuickSell with the same payload as the row menu", () => {
      const onQuickSell = jest.fn()
      const portfolio = makePortfolio()
      const asset = makeAsset({
        assetCategory: { id: "EQUITY", name: "Equity" },
      })
      const position = makePosition({
        asset,
        moneyValues: { weight: 0.25 },
        price: 150,
        quantityValues: { total: 100 },
      })
      const holdings = makeHoldings({
        portfolio,
        holdingGroups: { Equity: makeHoldingGroup({ positions: [position] }) },
      })
      render(
        <CardView
          holdings={holdings}
          portfolio={portfolio}
          valueIn={ValueIn.PORTFOLIO}
          onQuickSell={onQuickSell}
        />,
      )

      fireEvent.click(screen.getByRole("button", { name: /Actions AAPL/i }))
      fireEvent.click(screen.getByRole("button", { name: "Quick Sell" }))

      expect(onQuickSell).toHaveBeenCalledWith({
        asset: "AAPL",
        market: "NASDAQ",
        quantity: 100,
        price: 150,
        held: undefined,
      })
    })

    it("invokes onSetCashBalance for cash positions via CashActionsMenu", () => {
      const onSetCashBalance = jest.fn()
      const portfolio = makePortfolio()
      const cashAsset = makeAsset({
        id: "cash-usd",
        code: "USD",
        name: "US Dollar Cash",
        assetCategory: { id: "CASH", name: "Cash" },
        market: {
          code: "CASH",
          name: "Cash",
          currency: { code: "USD", symbol: "$", name: "US Dollar" },
        },
      })
      const cashPosition = makePosition({
        asset: cashAsset,
        moneyValues: { weight: 0.1, marketValue: 5000 },
        buckets: [ValueIn.PORTFOLIO, ValueIn.TRADE],
      })
      const holdings = makeHoldings({
        portfolio,
        holdingGroups: { Cash: makeHoldingGroup({ positions: [cashPosition] }) },
      })
      render(
        <CardView
          holdings={holdings}
          portfolio={portfolio}
          valueIn={ValueIn.PORTFOLIO}
          onSetCashBalance={onSetCashBalance}
        />,
      )

      fireEvent.click(screen.getByRole("button", { name: /Actions USD/i }))
      fireEvent.click(screen.getByRole("button", { name: "Set Balance" }))

      expect(onSetCashBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: "USD",
          market: "CASH",
          currentBalance: 5000,
        }),
      )
    })
  })
})
