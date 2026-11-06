import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import CardView from "../CardView"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import { useWatchlist } from "@hooks/useWatchlist"
import {
  makeAsset,
  makeHoldingGroup,
  makeHoldings,
  makePortfolio,
  makePosition,
  makeWatchlistItem,
} from "@test-fixtures/beancounter"

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false, toggleHideValues: jest.fn() }),
}))
jest.mock("@hooks/useWatchlist")

beforeEach(() => {
  window.localStorage.setItem(
    "bc:holdings:expandedGroups:",
    JSON.stringify(["Equity"]),
  )
})
afterEach(() => window.localStorage.clear())

const asset = makeAsset()

describe("CardView watch target", () => {
  it("shows the watchlist target with the card's price", () => {
    ;(useWatchlist as jest.Mock).mockReturnValue({
      items: [makeWatchlistItem({ asset, targetPrice: 150 })],
    })
    const portfolio = makePortfolio()
    const position = makePosition({
      asset,
      moneyValues: { weight: 0.25 },
      price: 120,
      quantityValues: { total: 100 },
    })
    render(
      <CardView
        holdings={makeHoldings({
          portfolio,
          holdingGroups: {
            Equity: makeHoldingGroup({ positions: [position] }),
          },
        })}
        portfolio={portfolio}
        valueIn={ValueIn.PORTFOLIO}
      />,
    )

    expect(screen.getByTestId("watch-target")).toHaveTextContent(
      "Target $150.00",
    )
  })
})
