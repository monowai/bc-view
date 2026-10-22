import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import Rows from "../Rows"
import CardView from "../CardView"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import type { Asset } from "types/beancounter"
import {
  makeAsset,
  makeCashAsset,
  makeHoldingGroup,
  makeHoldings,
  makePortfolio,
  makePosition,
} from "@test-fixtures/beancounter"

jest.mock("@components/ui/ProgressBar", () => ({
  AlphaProgress: () => <div data-testid="alpha-progress" />,
}))

jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    query: {},
    isReady: true,
    events: { on: jest.fn(), off: jest.fn() },
    prefetch: jest.fn(),
    beforePopState: jest.fn(),
  }),
}))

// The popup runs a live agent stream; only which asset it opens for matters here.
jest.mock("@components/features/assets/AssetReviewPopup", () => ({
  __esModule: true,
  default: ({
    ticker,
    market,
    assetName,
  }: {
    ticker: string
    market?: string
    assetName?: string
  }) => (
    <div data-testid="asset-review-popup">
      {`${ticker}|${market}|${assetName}`}
    </div>
  ),
}))

const portfolio = makePortfolio({ id: "pf-review" })

function positionOf(asset: Asset): ReturnType<typeof makePosition> {
  return makePosition({
    asset,
    moneyValues: { weight: 0.25 },
    price: 150,
    quantityValues: { total: 100 },
  })
}

function renderRow(asset: Asset): void {
  render(
    <table>
      <Rows
        portfolio={portfolio}
        groupBy="Equity"
        holdingGroup={makeHoldingGroup({ positions: [positionOf(asset)] })}
        valueIn={ValueIn.PORTFOLIO}
        onColumnsChange={jest.fn()}
      />
    </table>,
  )
}

function renderCard(asset: Asset): void {
  window.localStorage.setItem(
    "bc:holdings:expandedGroups:",
    JSON.stringify(["Equity"]),
  )
  render(
    <CardView
      holdings={makeHoldings({
        portfolio,
        holdingGroups: {
          Equity: makeHoldingGroup({ positions: [positionOf(asset)] }),
        },
      })}
      portfolio={portfolio}
      valueIn={ValueIn.PORTFOLIO}
    />,
  )
}

afterEach(() => window.localStorage.clear())

describe.each([
  ["rows", renderRow],
  ["cards", renderCard],
])("holding %s AI review", (_view, renderView) => {
  it("offers the AI review sparkle, and no News, for an equity", () => {
    renderView(makeAsset({ code: "AAPL", name: "Apple Inc" }))

    const review = screen.getByRole("button", { name: "AI review AAPL" })
    expect(review.querySelector(".fa-wand-magic-sparkles")).not.toBeNull()
    expect(
      screen.queryByRole("button", { name: /^News / }),
    ).not.toBeInTheDocument()
    expect(document.querySelector(".fa-newspaper")).toBeNull()
  })

  it("opens the asset review for the holding's asset", () => {
    renderView(makeAsset({ code: "AAPL", name: "Apple Inc" }))

    expect(screen.queryByTestId("asset-review-popup")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "AI review AAPL" }))
    expect(screen.getByTestId("asset-review-popup")).toHaveTextContent(
      "AAPL|NASDAQ|Apple Inc",
    )
  })

  it("shows no AI review for cash", () => {
    renderView(makeCashAsset())

    expect(
      screen.queryByRole("button", { name: /AI review/i }),
    ).not.toBeInTheDocument()
  })
})
