import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import WealthHeroSection from "../WealthHeroSection"
import PortfolioDetailsTable from "../PortfolioDetailsTable"
import { USD } from "@test-fixtures/beancounter"
import { WealthSummary } from "@lib/wealth/liquidityGroups"

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

const summary = (overrides: Partial<WealthSummary> = {}): WealthSummary => ({
  totalValue: 100_000,
  totalGainOnDay: 0,
  portfolioCount: 2,
  healthcareReserve: 0,
  classificationBreakdown: [],
  portfolioBreakdown: [],
  ...overrides,
})

describe("WealthHeroSection direction", () => {
  const renderHero = (gain: number): HTMLElement =>
    render(
      <WealthHeroSection
        summary={summary({ totalGainOnDay: gain })}
        displayCurrency={USD}
        currencies={[USD]}
        portfolios={[]}
        onCurrencyChange={jest.fn()}
        onShareClick={jest.fn()}
      />,
    ).container

  it("puts a loss sign before the currency symbol", () => {
    const text = renderHero(-250).textContent
    expect(text).toContain("-$250.00")
    expect(text).toContain("(-0.25%)")
  })

  it("signs a gain and its percentage", () => {
    const text = renderHero(1000).textContent
    expect(text).toContain("+$1,000.00")
    expect(text).toContain("(+1.01%)")
  })
})

describe("PortfolioDetailsTable", () => {
  const onSort = jest.fn()
  const onToggle = jest.fn()
  const renderTable = (collapsed = false): void => {
    render(
      <PortfolioDetailsTable
        summary={summary({
          portfolioBreakdown: [
            {
              code: "AAA",
              name: "AAA Fund",
              value: 60_000,
              percentage: 60,
              irr: 0.1,
            },
          ],
        } as Partial<WealthSummary>)}
        sortConfig={{ key: "value", direction: "desc" }}
        onSort={onSort}
        displayCurrency={USD}
        collapsed={collapsed}
        onToggle={onToggle}
      />,
    )
  }

  beforeEach(() => jest.clearAllMocks())

  it("exposes the section state on its toggle", () => {
    renderTable()
    fireEvent.click(
      screen.getByRole("button", {
        name: "Portfolio Details",
        expanded: true,
      }),
    )
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it("sorts from labelled header buttons", () => {
    renderTable()
    fireEvent.click(screen.getByRole("button", { name: /^IRR/ }))
    expect(onSort).toHaveBeenCalledWith("irr")
    expect(
      screen.getByRole("columnheader", { name: /^Value/ }),
    ).toHaveAttribute("aria-sort", "descending")
  })

  it("signs a positive IRR", () => {
    renderTable()
    expect(screen.getByText("+10.00%")).toBeInTheDocument()
  })
})
