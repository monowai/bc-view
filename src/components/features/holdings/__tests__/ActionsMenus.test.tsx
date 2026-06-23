import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { ActionsMenu, CashActionsMenu } from "../ActionsMenus"
import { makeAsset } from "@test-fixtures/beancounter"

const asset = makeAsset({ id: "asset-aapl", code: "AAPL" })

const baseProps = {
  asset,
  portfolioId: "ctx",
  portfolioCode: "CTX",
  quantity: 10,
  price: 100,
  costBasis: 900,
  tradeCurrency: { code: "USD", symbol: "$", name: "Dollar" },
  valueIn: "PORTFOLIO",
}

const openMenu = (): void => {
  fireEvent.click(screen.getByRole("button", { name: /Actions AAPL/i }))
}

describe("ActionsMenu", () => {
  it("includes the asset id in the trade payload so the page can resolve the portfolio", () => {
    const onTrade = jest.fn()
    render(<ActionsMenu {...baseProps} onTrade={onTrade} />)
    openMenu()
    fireEvent.click(screen.getByRole("button", { name: "Trade" }))
    expect(onTrade).toHaveBeenCalledWith(
      expect.objectContaining({ asset: "AAPL", assetId: "asset-aapl" }),
    )
  })

  it("renders Go to portfolio and calls onGoToPortfolio with the asset", () => {
    const onGoToPortfolio = jest.fn()
    render(<ActionsMenu {...baseProps} onGoToPortfolio={onGoToPortfolio} />)
    openMenu()
    fireEvent.click(screen.getByRole("button", { name: "Go to portfolio" }))
    expect(onGoToPortfolio).toHaveBeenCalledWith(asset)
  })

  it("omits Go to portfolio when no handler is provided", () => {
    render(<ActionsMenu {...baseProps} onTrade={jest.fn()} />)
    openMenu()
    expect(
      screen.queryByRole("button", { name: "Go to portfolio" }),
    ).not.toBeInTheDocument()
  })
})

describe("CashActionsMenu", () => {
  const cashAsset = makeAsset({ id: "asset-dbs", code: "DBS" })
  const cashProps = {
    asset: cashAsset,
    portfolio: { id: "p1", code: "SGD" },
    marketValue: 1000,
    tradeCurrency: { code: "SGD", symbol: "$", name: "Singapore Dollar" },
  }
  const openCashMenu = (): void => {
    fireEvent.click(screen.getByRole("button", { name: /Actions DBS/i }))
  }

  it("renders Exchange Cash and opens the cash transaction seeded with FX", () => {
    const onCashTransaction = jest.fn()
    render(
      <CashActionsMenu {...cashProps} onCashTransaction={onCashTransaction} />,
    )
    openCashMenu()
    fireEvent.click(screen.getByRole("button", { name: "Exchange Cash" }))
    expect(onCashTransaction).toHaveBeenCalledWith("DBS", "FX")
  })

  it("Cash Transaction opens with no preset type (default deposit)", () => {
    const onCashTransaction = jest.fn()
    render(
      <CashActionsMenu {...cashProps} onCashTransaction={onCashTransaction} />,
    )
    openCashMenu()
    fireEvent.click(screen.getByRole("button", { name: "Cash Transaction" }))
    expect(onCashTransaction).toHaveBeenCalledWith("DBS")
  })
})
