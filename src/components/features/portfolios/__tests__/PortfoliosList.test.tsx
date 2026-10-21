import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import PortfoliosList from "../PortfoliosList"
import { makePortfolio, NZD, USD } from "@test-fixtures/beancounter"

jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({ ai: false, preview: false, admin: false }),
}))
jest.mock("@components/features/holdings/usePortfolioReview", () => ({
  usePortfolioReview: () => ({ popup: null, showReview: jest.fn() }),
}))

const usdPortfolio = makePortfolio({
  id: "p-usd",
  code: "USDP",
  name: "Dollar Portfolio",
  base: USD,
  marketValue: 10000,
})
const nzdPortfolio = makePortfolio({
  id: "p-nzd",
  code: "NZDP",
  name: "Kiwi Portfolio",
  base: NZD,
  currency: NZD,
  marketValue: 20000,
})

function renderList(fxRates: Record<string, number>): void {
  render(
    <PortfoliosList
      portfolios={[usdPortfolio, nzdPortfolio]}
      displayCurrency={USD}
      currencies={[USD, NZD]}
      fxRates={fxRates}
      onCurrencyChange={jest.fn()}
      onImportClick={jest.fn()}
      onShareClick={jest.fn()}
      onCorporateActions={jest.fn()}
      onDelete={jest.fn()}
    />,
  )
}

describe("PortfoliosList FX conversion", () => {
  it("converts each portfolio and the total at its rate", () => {
    renderList({ USD: 1, NZD: 0.6 })

    expect(screen.getAllByText("12,000.00").length).toBeGreaterThan(0)
    expect(screen.getAllByText("22,000.00").length).toBeGreaterThan(0)
  })

  it("shows a placeholder, not the unconverted value, when a portfolio's rate is missing", () => {
    renderList({ USD: 1 })

    expect(screen.getAllByText("10,000.00").length).toBeGreaterThan(0)
    expect(screen.queryAllByText("20,000.00")).toHaveLength(0)
  })

  it("does not add a portfolio without a rate into the total", () => {
    renderList({ USD: 1 })

    expect(screen.queryAllByText("30,000.00")).toHaveLength(0)
    expect(screen.getAllByText("–").length).toBeGreaterThan(0)
  })

  it("treats a portfolio already in the display currency as rate 1", () => {
    renderList({})

    expect(screen.getAllByText("10,000.00").length).toBeGreaterThan(0)
  })
})
