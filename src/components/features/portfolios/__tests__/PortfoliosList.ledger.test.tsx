import React from "react"
import { render, screen, within, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { Currency, Portfolio } from "types/beancounter"
import PortfoliosList from "../PortfoliosList"

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({ canUseAi: true }),
}))
jest.mock("@components/features/portfolios/usePortfolioReview", () => ({
  usePortfolioReview: () => ({ popup: null, showReview: jest.fn() }),
}))

const usd = { code: "USD", symbol: "$" } as Currency

const portfolio = (
  code: string,
  marketValue: number,
  gainOnDay: number,
  irr: number,
): Portfolio =>
  ({
    id: code.toLowerCase(),
    code,
    name: `${code} Fund`,
    currency: usd,
    base: usd,
    marketValue,
    gainOnDay,
    irr,
  }) as Portfolio

const renderList = (portfolios: Portfolio[]): void => {
  window.localStorage.clear()
  render(
    <PortfoliosList
      portfolios={portfolios}
      displayCurrency={usd}
      currencies={[usd]}
      fxRates={{}}
      onCurrencyChange={jest.fn()}
      onImportClick={jest.fn()}
      onShareClick={jest.fn()}
      onCorporateActions={jest.fn()}
      onDelete={jest.fn()}
    />,
  )
}

describe("PortfoliosList ledger", () => {
  const book = [
    portfolio("AAA", 750, 7.5, 0.1),
    portfolio("BBB", 250, -5, -0.05),
  ]

  it("leads with the total, its day move and the portfolio count", () => {
    renderList(book)
    const summary = screen.getByTestId("portfolios-summary")
    expect(within(summary).getByText("1,000.00")).toBeInTheDocument()
    expect(within(summary).getByText("+0.25%")).toBeInTheDocument()
    expect(within(summary).getByText("2 portfolios")).toBeInTheDocument()
  })

  it("signs gains and losses so direction never relies on colour", () => {
    renderList(book)
    const row = screen.getAllByRole("row", { name: /AAA/ })[0]
    expect(within(row).getByText("+1.01%")).toBeInTheDocument()
    expect(within(row).getByText("+10.00%")).toBeInTheDocument()
    const loser = screen.getAllByRole("row", { name: /BBB/ })[0]
    expect(within(loser).getByText("-1.96%")).toBeInTheDocument()
    expect(within(loser).getByText("-5.00%")).toBeInTheDocument()
  })

  it("shows each portfolio's share of the total", () => {
    renderList(book)
    const row = screen.getAllByRole("row", { name: /AAA/ })[0]
    expect(within(row).getByText("75.0%")).toBeInTheDocument()
  })

  it("opens a portfolio through a real link", () => {
    renderList(book)
    expect(screen.getAllByRole("link", { name: "AAA" })[0]).toHaveAttribute(
      "href",
      "/holdings/AAA",
    )
  })

  it("names every row action for assistive technology", () => {
    renderList(book)
    expect(
      screen.getAllByRole("button", { name: "Delete AAA" }).length,
    ).toBeGreaterThan(0)
  })

  it("offers the selection total and a way to clear it", () => {
    renderList(book)
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Select AAA" })[0])
    const tray = screen.getByRole("region", { name: "Selected portfolios" })
    expect(within(tray).getByText("1 selected")).toBeInTheDocument()
    expect(within(tray).getByText("750.00")).toBeInTheDocument()
    expect(
      within(tray).getByRole("button", { name: "Holdings" }),
    ).toHaveAttribute("title", "View selected portfolios as one")
    fireEvent.click(within(tray).getByRole("button", { name: "Clear" }))
    expect(
      screen.queryByRole("region", { name: "Selected portfolios" }),
    ).not.toBeInTheDocument()
  })
})
