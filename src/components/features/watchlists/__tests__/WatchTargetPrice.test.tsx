import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import WatchTargetPrice from "../WatchTargetPrice"
import { useWatchlist } from "@hooks/useWatchlist"
import { NZD, makeAsset, makeWatchlistItem } from "@test-fixtures/beancounter"
import type { WatchlistItem } from "types/beancounter"

jest.mock("@hooks/useWatchlist")

function watching(items: WatchlistItem[] | undefined): void {
  ;(useWatchlist as jest.Mock).mockReturnValue({
    items,
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
  })
}

const asset = makeAsset({ id: "asset-aapl" })

describe("WatchTargetPrice", () => {
  it("shows the watch target in the price's own currency symbol", () => {
    watching([makeWatchlistItem({ asset, targetPrice: 150 })])
    render(<WatchTargetPrice assetId="asset-aapl" currencyCode="USD" />)

    const target = screen.getByTestId("watch-target")
    expect(target).toHaveTextContent("Target $150.00")
    expect(target).toHaveAttribute("title", "Watchlist target $150.00")
  })

  it("names the target's currency when the price is shown in another one", () => {
    watching([makeWatchlistItem({ asset, targetPrice: 150 })])
    render(<WatchTargetPrice assetId="asset-aapl" currencyCode="NZD" />)

    expect(screen.getByTestId("watch-target")).toHaveTextContent(
      "Target USD 150.00",
    )
  })

  it("formats the target to the given scale", () => {
    watching([makeWatchlistItem({ asset, targetPrice: 0.6123, currency: NZD })])
    render(
      <WatchTargetPrice assetId="asset-aapl" currencyCode="NZD" scale={4} />,
    )

    expect(screen.getByTestId("watch-target")).toHaveTextContent(
      "Target NZ$0.6123",
    )
  })

  it("renders nothing when the asset is watched without a target", () => {
    watching([makeWatchlistItem({ asset, targetPrice: null })])
    render(<WatchTargetPrice assetId="asset-aapl" currencyCode="USD" />)
    expect(screen.queryByTestId("watch-target")).not.toBeInTheDocument()
  })

  it("renders nothing when the asset is not on the watchlist", () => {
    watching([makeWatchlistItem({ asset: makeAsset({ id: "other" }) })])
    render(<WatchTargetPrice assetId="asset-aapl" currencyCode="USD" />)
    expect(screen.queryByTestId("watch-target")).not.toBeInTheDocument()
  })

  it("renders nothing while the watchlist loads", () => {
    watching(undefined)
    render(<WatchTargetPrice assetId="asset-aapl" currencyCode="USD" />)
    expect(screen.queryByTestId("watch-target")).not.toBeInTheDocument()
  })
})
