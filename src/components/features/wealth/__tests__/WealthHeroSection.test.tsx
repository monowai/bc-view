import React from "react"
import { render, screen, RenderResult } from "@testing-library/react"
import "@testing-library/jest-dom"
import WealthHeroSection from "../WealthHeroSection"
import { USD, makePortfolio } from "@test-fixtures/beancounter"
import { WealthSummary } from "@lib/wealth/liquidityGroups"
import { Portfolio } from "types/beancounter"

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

function makeSummary(overrides: Partial<WealthSummary> = {}): WealthSummary {
  return {
    totalValue: 100_000,
    totalGainOnDay: 0,
    portfolioCount: 1,
    healthcareReserve: 0,
    classificationBreakdown: [],
    portfolioBreakdown: [],
    ...overrides,
  }
}

function renderHero(
  summary: WealthSummary,
  portfolios: Portfolio[] = [],
): RenderResult {
  return render(
    <WealthHeroSection
      summary={summary}
      displayCurrency={USD}
      currencies={[USD]}
      portfolios={portfolios}
      onCurrencyChange={() => {}}
      onShareClick={() => {}}
    />,
  )
}

// Keep React in scope for the @testing-library JSX above without tripping
// the unused-import diagnostic. react/react-in-jsx-scope demands the
// import; TS6133 demands a use.
void React

describe("WealthHeroSection — today's gain percent", () => {
  it("renders the gain percent next to the dollar gain when totalGainOnDay > 0", () => {
    // gain 2,500 on prior-day value 97,500 → ~2.56% rise
    renderHero(makeSummary({ totalValue: 100_000, totalGainOnDay: 2_500 }))
    expect(screen.getByText(/\(2\.56%\)/)).toBeInTheDocument()
    expect(screen.getByText(/today/)).toBeInTheDocument()
  })

  it("renders a negative percent when totalGainOnDay < 0", () => {
    // -10,830.75 from prior-day value 1,875,476.08 → -0.58%
    renderHero(
      makeSummary({
        totalValue: 1_864_645.33,
        totalGainOnDay: -10_830.75,
      }),
    )
    expect(screen.getByText(/\(-0\.58%\)/)).toBeInTheDocument()
  })

  it("omits the percent when totalGainOnDay equals zero (whole gain block is hidden)", () => {
    renderHero(makeSummary({ totalValue: 100_000, totalGainOnDay: 0 }))
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/today/)).not.toBeInTheDocument()
  })

  it("omits the percent when prior-day value resolves to zero (avoid divide-by-zero)", () => {
    // edge case: a new account where today's first deposit equals totalValue
    renderHero(makeSummary({ totalValue: 500, totalGainOnDay: 500 }))
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    expect(screen.getByText(/today/)).toBeInTheDocument()
  })
})

describe("WealthHeroSection — net worth links to aggregate holdings", () => {
  it("links the net worth figure to the aggregated holdings view", () => {
    renderHero(makeSummary({ totalValue: 100_000 }))
    const link = screen.getByTitle(/holdings contributing to your net worth/i)
    expect(link).toHaveAttribute("href", "/holdings/aggregated")
  })

  it("drills straight to the sole portfolio's holdings in zen mode (one portfolio)", () => {
    renderHero(makeSummary({ totalValue: 100_000, portfolioCount: 1 }), [
      makePortfolio({ code: "MAIN" }),
    ])
    const link = screen.getByTitle(/holdings contributing to your net worth/i)
    expect(link).toHaveAttribute("href", "/holdings/MAIN")
  })

  it("passes the contributing portfolio codes when portfolios are present", () => {
    renderHero(makeSummary({ totalValue: 100_000, portfolioCount: 2 }), [
      makePortfolio({ code: "ALPHA" }),
      makePortfolio({ code: "BETA" }),
    ])
    const link = screen.getByTitle(/holdings contributing to your net worth/i)
    expect(link).toHaveAttribute(
      "href",
      "/holdings/aggregated?codes=ALPHA%2CBETA",
    )
  })
})

describe("WealthHeroSection — Healthcare Reserve", () => {
  it("renders the 'Includes Healthcare Reserve' line when summary.healthcareReserve > 0", () => {
    renderHero(makeSummary({ healthcareReserve: 58_000 }))
    expect(screen.getByText(/Includes Healthcare Reserve/)).toBeInTheDocument()
  })

  it("hides the Healthcare Reserve line when summary.healthcareReserve is zero", () => {
    renderHero(makeSummary({ healthcareReserve: 0 }))
    expect(screen.queryByText(/Healthcare Reserve/)).not.toBeInTheDocument()
  })
})
