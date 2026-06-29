import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import TradeAssetAction from "../TradeAssetAction"
import { makePortfolio } from "@test-fixtures/beancounter"
import type { AssetOption } from "types/beancounter"

const mockUsePortfolios = jest.fn()
jest.mock("@hooks/usePortfolios", () => ({
  usePortfolios: () => mockUsePortfolios(),
}))

// Stub the heavy trade form — we only assert it opens with the chosen portfolio.
jest.mock("../TradeInputForm", () => ({
  __esModule: true,
  default: ({
    portfolio,
    initialValues,
  }: {
    portfolio: { code: string }
    initialValues?: { asset: string }
  }) => (
    <div data-testid="trade-form">
      {`form:${portfolio.code}:${initialValues?.asset}`}
    </div>
  ),
}))

const asset: AssetOption = {
  value: "AAPL",
  label: "AAPL - Apple (NASDAQ)",
  symbol: "AAPL",
  name: "Apple",
  market: "NASDAQ",
  assetId: "asset-aapl",
  currency: "USD",
}

const setPortfolios = (ps: ReturnType<typeof makePortfolio>[]): void => {
  mockUsePortfolios.mockReturnValue({ portfolios: ps })
}

beforeEach(() => mockUsePortfolios.mockReset())

describe("TradeAssetAction", () => {
  it("renders a Trade button", () => {
    setPortfolios([makePortfolio({ id: "p1", code: "MAIN" })])
    render(<TradeAssetAction asset={asset} />)
    expect(
      screen.getByRole("button", { name: /Trade AAPL/i }),
    ).toBeInTheDocument()
  })

  it("disables the button when the user has no portfolios", () => {
    setPortfolios([])
    render(<TradeAssetAction asset={asset} />)
    expect(screen.getByRole("button", { name: /Trade AAPL/i })).toBeDisabled()
  })

  it("opens the trade form directly for a single portfolio (no prompt)", () => {
    setPortfolios([makePortfolio({ id: "p1", code: "MAIN" })])
    render(<TradeAssetAction asset={asset} />)
    fireEvent.click(screen.getByRole("button", { name: /Trade AAPL/i }))
    // No portfolio-choice dialog
    expect(screen.queryByText(/choose portfolio/i)).not.toBeInTheDocument()
    expect(screen.getByTestId("trade-form")).toHaveTextContent("form:MAIN:AAPL")
  })

  it("prompts for the portfolio first when there are several, then opens the form", () => {
    setPortfolios([
      makePortfolio({ id: "p1", code: "MAIN", name: "Main" }),
      makePortfolio({ id: "p2", code: "IBKR", name: "Broker" }),
    ])
    render(<TradeAssetAction asset={asset} />)
    fireEvent.click(screen.getByRole("button", { name: /Trade AAPL/i }))

    // Prompt shown, form not yet open
    expect(screen.getByText(/choose portfolio/i)).toBeInTheDocument()
    expect(screen.queryByTestId("trade-form")).not.toBeInTheDocument()

    // Pick the second portfolio → form opens pinned to it
    fireEvent.click(screen.getByRole("button", { name: /Broker/i }))
    expect(screen.getByTestId("trade-form")).toHaveTextContent("form:IBKR:AAPL")
  })
})
