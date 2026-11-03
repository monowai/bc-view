import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { makeCurrency, makePortfolio } from "@test-fixtures/beancounter"
import PortfoliosList from "@components/features/portfolios/PortfoliosList"

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn(), query: {}, pathname: "/portfolios" }),
}))

jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({ canUseAi: false }),
}))

jest.mock("@components/features/portfolios/usePortfolioReview", () => ({
  usePortfolioReview: () => ({ popup: null, showReview: jest.fn() }),
}))

describe("PortfoliosList header", () => {
  it("sorts from a labelled header button", () => {
    const usd = makeCurrency({ code: "USD" })
    render(
      <PortfoliosList
        portfolios={[makePortfolio({ currency: usd, base: usd })]}
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

    const th = screen.getAllByText("Code")[0].closest("th")
    expect(th).toHaveAttribute("aria-sort", "ascending")
    expect(screen.getByRole("button", { name: /^Code/ })).toBeInTheDocument()
  })
})
