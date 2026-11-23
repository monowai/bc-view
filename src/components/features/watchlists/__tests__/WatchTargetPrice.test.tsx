import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import WatchTargetPrice from "../WatchTargetPrice"
import { useWatchlist } from "@hooks/useWatchlist"
import { NZD, makeAsset, makeWatchlistItem } from "@test-fixtures/beancounter"
import type { WatchlistItem } from "types/beancounter"
import { updateWatchlistItem } from "@utils/api/client/watchlist"

jest.mock("@hooks/useWatchlist")
jest.mock("swr", () => ({ mutate: jest.fn() }))
jest.mock("@utils/api/client/watchlist", () => ({
  ...jest.requireActual("@utils/api/client/watchlist"),
  updateWatchlistItem: jest.fn(),
}))

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

  it("shows Watching when the asset is watched without a target", () => {
    watching([makeWatchlistItem({ asset, targetPrice: null })])
    render(<WatchTargetPrice assetId="asset-aapl" currencyCode="USD" />)

    const marker = screen.getByTestId("watch-target")
    expect(marker).toHaveTextContent("Watching")
    expect(marker).not.toHaveTextContent("Target")
  })

  it("sets a target from the marker on an item that has none", async () => {
    const item = makeWatchlistItem({ id: "wi-1", asset, targetPrice: null })
    watching([item])
    ;(updateWatchlistItem as jest.Mock).mockResolvedValue({
      ...item,
      targetPrice: 183,
    })
    render(<WatchTargetPrice assetId="asset-aapl" currencyCode="USD" />)

    fireEvent.click(screen.getByTestId("watch-target"))
    fireEvent.change(screen.getByLabelText(/Target price/), {
      target: { value: "183" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(updateWatchlistItem).toHaveBeenCalledWith("wi-1", {
        targetPrice: 183,
      }),
    )
    await waitFor(() =>
      expect(screen.queryByLabelText(/Target price/)).not.toBeInTheDocument(),
    )
  })

  it("keeps clicks on the marker and its dialog from reaching the row", () => {
    watching([makeWatchlistItem({ asset, targetPrice: 150 })])
    const onRowClick = jest.fn()
    const onRowDoubleClick = jest.fn()
    render(
      <div onClick={onRowClick} onDoubleClick={onRowDoubleClick}>
        <WatchTargetPrice assetId="asset-aapl" currencyCode="USD" />
      </div>,
    )

    fireEvent.click(screen.getByTestId("watch-target"))
    const field = screen.getByLabelText(/Target price/)
    fireEvent.click(field)
    fireEvent.doubleClick(field)

    expect(field).toHaveValue("150")
    expect(onRowClick).not.toHaveBeenCalled()
    expect(onRowDoubleClick).not.toHaveBeenCalled()
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
