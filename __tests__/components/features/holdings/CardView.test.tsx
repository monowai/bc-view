import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import {
  makeCurrency,
  makeHoldingGroup,
  makeHoldings,
  makePortfolio,
  makePosition,
} from "@test-fixtures/beancounter"

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn(), query: {} }),
}))

jest.mock("@components/features/holdings/useNewsAsset", () => ({
  useNewsAsset: () => ({ newsAsset: null, setNewsAsset: jest.fn() }),
}))

// The user has picked a custom display currency (NZD) while the holdings
// are denominated in USD. The hook already converts every amount and
// resolves the effective symbol; the header must label the amounts with
// the same effective code, not the source one.
jest.mock("@lib/hooks/useDisplayCurrencyConversion", () => ({
  useDisplayCurrencyConversion: () => ({
    convert: (v: number) => v * 1.6,
    currencySymbol: "NZ$",
    currencyCode: "NZD",
    isCustomCurrency: true,
    isLoading: false,
  }),
}))

import CardView from "@components/features/holdings/CardView"

const USD = makeCurrency({ code: "USD", symbol: "$" })

function renderCardView(): void {
  const portfolio = makePortfolio({ currency: USD, base: USD })
  const holdings = makeHoldings({
    portfolio,
    holdingGroups: {
      Equity: makeHoldingGroup({
        positions: [makePosition()],
        subTotals: { marketValue: 10000, totalGain: 1000, gainOnDay: 50 },
      }),
    },
  })
  render(
    <CardView holdings={holdings} portfolio={portfolio} valueIn="PORTFOLIO" />,
  )
}

describe("CardView summary header", () => {
  it("labels the converted totals with the effective display currency", () => {
    renderCardView()
    expect(screen.getByText(/NZD · 1 holding/)).toBeInTheDocument()
    expect(screen.queryByText(/USD · 1 holding/)).not.toBeInTheDocument()
  })
})
