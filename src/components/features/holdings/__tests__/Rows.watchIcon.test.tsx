import React from "react"
import { render, screen, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import Rows from "../Rows"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import { useWatchlist } from "@hooks/useWatchlist"
import {
  makeAsset,
  makeHoldingGroup,
  makePortfolio,
  makePosition,
  makeWatchlistItem,
} from "@test-fixtures/beancounter"

jest.mock("@components/ui/ProgressBar", () => ({
  AlphaProgress: () => <div data-testid="alpha-progress" />,
}))
jest.mock("@hooks/useWatchlist")

const asset = makeAsset()

function renderRow(): void {
  const position = makePosition({
    asset,
    moneyValues: { weight: 0.25 },
    price: 120,
    quantityValues: { total: 100 },
  })
  render(
    <table>
      <Rows
        portfolio={makePortfolio({ id: "pf-rows" })}
        groupBy="Equity"
        holdingGroup={makeHoldingGroup({ positions: [position] })}
        valueIn={ValueIn.PORTFOLIO}
        onColumnsChange={jest.fn()}
        onPriceChart={jest.fn()}
      />
    </table>,
  )
}

describe("Rows watch icon", () => {
  it("shows the watch icon beside the asset name, not under the price", () => {
    ;(useWatchlist as jest.Mock).mockReturnValue({
      items: [makeWatchlistItem({ asset, targetPrice: 150 })],
    })
    renderRow()

    const nameCell = screen
      .getByTitle(asset.displayCode)
      .closest("td") as HTMLElement
    expect(within(nameCell).getByTestId("watch-icon")).toBeInTheDocument()
    const priceCell = screen
      .getByRole("button", { name: "Show price chart for AAPL" })
      .closest("td") as HTMLElement
    expect(within(priceCell).queryByText(/Target/)).not.toBeInTheDocument()
  })

  it("shows no watch icon when the asset is not watched", () => {
    ;(useWatchlist as jest.Mock).mockReturnValue({ items: [] })
    renderRow()
    expect(screen.queryByTestId("watch-icon")).not.toBeInTheDocument()
  })
})
