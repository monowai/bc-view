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
})
