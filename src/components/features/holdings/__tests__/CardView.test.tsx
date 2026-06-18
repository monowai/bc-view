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

const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: mockPush,
    query: {},
    isReady: true,
    events: { on: jest.fn(), off: jest.fn() },
    prefetch: jest.fn(),
    beforePopState: jest.fn(),
  }),
}))

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

  describe("portfolio breakdown click", () => {
    it("renders quantity as a button and invokes onPortfolioBreakdown when breakdown has multiple entries", () => {
      const onPortfolioBreakdown = jest.fn()
      const portfolio = makePortfolio()
      const asset = makeAsset({
        assetCategory: { id: "EQUITY", name: "Equity" },
      })
      const position = makePosition({
        asset,
        moneyValues: { weight: 0.25 },
        price: 150,
        quantityValues: { total: 100 },
        overrides: {
          portfolioBreakdown: [
            {
              portfolioId: "p1",
              portfolioCode: "MAIN",
              portfolioName: "Main Account",
              quantity: 60,
            },
            {
              portfolioId: "p2",
              portfolioCode: "ISA",
              portfolioName: "ISA",
              quantity: 40,
            },
          ],
        },
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
          onPortfolioBreakdown={onPortfolioBreakdown}
        />,
      )

      const button = screen.getByRole("button", {
        name: /Show portfolios holding AAPL/i,
      })
      fireEvent.click(button)
      expect(onPortfolioBreakdown).toHaveBeenCalledWith(
        expect.objectContaining({
          asset: expect.objectContaining({ code: "AAPL" }),
          breakdown: expect.arrayContaining([
            expect.objectContaining({ portfolioCode: "MAIN" }),
            expect.objectContaining({ portfolioCode: "ISA" }),
          ]),
        }),
      )
    })

    it("renders a quantity button even when breakdown has a single entry", () => {
      const onPortfolioBreakdown = jest.fn()
      const portfolio = makePortfolio()
      const position = makePosition({
        moneyValues: { weight: 0.25 },
        price: 150,
        quantityValues: { total: 100 },
        overrides: {
          portfolioBreakdown: [
            {
              portfolioId: "p1",
              portfolioCode: "MAIN",
              portfolioName: "Main Account",
              quantity: 100,
            },
          ],
        },
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
          onPortfolioBreakdown={onPortfolioBreakdown}
        />,
      )
      const button = screen.getByRole("button", {
        name: /Show portfolios holding AAPL/i,
      })
      fireEvent.click(button)
      expect(onPortfolioBreakdown).toHaveBeenCalledWith(
        expect.objectContaining({
          breakdown: expect.arrayContaining([
            expect.objectContaining({ portfolioCode: "MAIN" }),
          ]),
        }),
      )
    })

    it("does not render a quantity button when breakdown is missing", () => {
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
          onPortfolioBreakdown={jest.fn()}
        />,
      )
      expect(
        screen.queryByRole("button", { name: /Show portfolios holding/i }),
      ).not.toBeInTheDocument()
    })

    it("does not render a quantity button when handler is omitted", () => {
      const portfolio = makePortfolio()
      const position = makePosition({
        moneyValues: { weight: 0.25 },
        price: 150,
        quantityValues: { total: 100 },
        overrides: {
          portfolioBreakdown: [
            {
              portfolioId: "p1",
              portfolioCode: "MAIN",
              portfolioName: "Main",
              quantity: 60,
            },
            {
              portfolioId: "p2",
              portfolioCode: "ISA",
              portfolioName: "ISA",
              quantity: 40,
            },
          ],
        },
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
      expect(
        screen.queryByRole("button", { name: /Show portfolios holding/i }),
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

    it("invokes onEditAsset for PRIVATE/POLICY assets", () => {
      const onEditAsset = jest.fn()
      const portfolio = makePortfolio()
      const asset = makeAsset({
        id: "policy-1",
        code: "CPF",
        name: "CPF Composite",
        assetCategory: { id: "POLICY", name: "Policies" },
        market: {
          code: "PRIVATE",
          name: "Private",
          currency: { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
        },
      })
      const position = makePosition({
        asset,
        moneyValues: { weight: 0.25, marketValue: 100000 },
        quantityValues: { total: 1 },
      })
      const holdings = makeHoldings({
        portfolio,
        holdingGroups: { Policy: makeHoldingGroup({ positions: [position] }) },
      })
      render(
        <CardView
          holdings={holdings}
          portfolio={portfolio}
          valueIn={ValueIn.PORTFOLIO}
          onEditAsset={onEditAsset}
        />,
      )

      fireEvent.click(screen.getByRole("button", { name: /Actions CPF/i }))
      fireEvent.click(screen.getByRole("button", { name: "Edit Asset" }))

      expect(onEditAsset).toHaveBeenCalledWith(asset)
    })

    // After the admin-edit feature: the PRIVATE-market gate moved out of
    // ActionsMenu into the page. Edit Asset shows whenever `onEditAsset` is
    // wired by the page; pages only wire it for assets the caller can edit
    // (PRIVATE for the owner, anything for an admin). So the menu-level
    // invariant is now: no `onEditAsset` prop → no item.
    it("hides Edit Asset when onEditAsset is not provided", () => {
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
      expect(
        screen.queryByRole("button", { name: "Edit Asset" }),
      ).not.toBeInTheDocument()
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
        holdingGroups: {
          Cash: makeHoldingGroup({ positions: [cashPosition] }),
        },
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

  describe("trade-history drill-down", () => {
    beforeEach(() => mockPush.mockClear())

    it("double-click routes to the single-portfolio trades page when not aggregated", () => {
      const portfolio = makePortfolio()
      const asset = makeAsset({ id: "asset-aapl" })
      const position = makePosition({ asset, quantityValues: { total: 100 } })
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

      fireEvent.doubleClick(document.getElementById("asset-asset-aapl")!)

      expect(mockPush).toHaveBeenCalledWith(
        `/trns/trades/${portfolio.id}/asset-aapl`,
      )
    })

    it("double-click routes to the aggregated trades page when the asset is held across portfolios", () => {
      const portfolio = makePortfolio()
      const asset = makeAsset({ id: "asset-aapl" })
      const position = makePosition({
        asset,
        quantityValues: { total: 100 },
        overrides: {
          portfolioBreakdown: [
            {
              portfolioId: "p-1",
              portfolioCode: "GROWTH",
              portfolioName: "Growth",
              quantity: 60,
            },
            {
              portfolioId: "p-2",
              portfolioCode: "KIDS",
              portfolioName: "Kids",
              quantity: 40,
            },
          ],
        },
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

      fireEvent.doubleClick(document.getElementById("asset-asset-aapl")!)

      expect(mockPush).toHaveBeenCalledWith(
        "/trns/trades/asset-aapl?portfolios=p-1,p-2",
      )
    })
  })
})
