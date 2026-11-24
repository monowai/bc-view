import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import WatchIcon from "../WatchIcon"
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
const icon = (): HTMLElement => screen.getByTestId("watch-icon")
const glyph = (): Element | null => icon().querySelector("i")

describe("WatchIcon", () => {
  it("shows a target icon with the target and distance in its tooltip", () => {
    watching([makeWatchlistItem({ asset, targetPrice: 150, toTarget: 0.25 })])
    render(<WatchIcon assetId="asset-aapl" />)

    expect(glyph()).toHaveClass("fa-bullseye")
    expect(icon()).toHaveAttribute(
      "title",
      "Target USD 150.00 · Price is off by 25.00%",
    )
    expect(icon()).toHaveTextContent("")
  })

  it("gives the distance to a target below the price as a magnitude", () => {
    watching([makeWatchlistItem({ asset, targetPrice: 150, toTarget: -0.098 })])
    render(<WatchIcon assetId="asset-aapl" />)

    expect(icon()).toHaveAttribute(
      "title",
      "Target USD 150.00 · Price is off by 9.80%",
    )
  })

  it("says when the price is at the target", () => {
    watching([
      makeWatchlistItem({ asset, targetPrice: 150, toTarget: 0.00001 }),
    ])
    render(<WatchIcon assetId="asset-aapl" />)

    expect(icon()).toHaveAttribute(
      "title",
      "Target USD 150.00 · Price is at target",
    )
  })

  it("leaves the distance out when the server has none", () => {
    watching([makeWatchlistItem({ asset, targetPrice: 150, toTarget: null })])
    render(<WatchIcon assetId="asset-aapl" />)

    expect(icon()).toHaveAttribute("title", "Target USD 150.00")
  })

  it("formats the target to the given scale", () => {
    watching([
      makeWatchlistItem({
        asset,
        targetPrice: 0.6123,
        currency: NZD,
        toTarget: null,
      }),
    ])
    render(<WatchIcon assetId="asset-aapl" scale={4} />)

    expect(icon()).toHaveAttribute("title", "Target NZD 0.6123")
  })

  it("shows a watch icon when the asset is watched without a target", () => {
    watching([makeWatchlistItem({ asset, targetPrice: null, toTarget: null })])
    render(<WatchIcon assetId="asset-aapl" />)

    expect(glyph()).toHaveClass("fa-eye")
    expect(icon()).toHaveAttribute("title", "Watching, no target")
  })

  it("renders nothing when the asset is not on the watchlist", () => {
    watching([makeWatchlistItem({ asset: makeAsset({ id: "other" }) })])
    render(<WatchIcon assetId="asset-aapl" />)
    expect(screen.queryByTestId("watch-icon")).not.toBeInTheDocument()
  })

  it("renders nothing while the watchlist loads", () => {
    watching(undefined)
    render(<WatchIcon assetId="asset-aapl" />)
    expect(screen.queryByTestId("watch-icon")).not.toBeInTheDocument()
  })

  it("sets a target from the watch icon", async () => {
    const item = makeWatchlistItem({ id: "wi-1", asset, targetPrice: null })
    watching([item])
    ;(updateWatchlistItem as jest.Mock).mockResolvedValue({
      ...item,
      targetPrice: 183,
    })
    render(<WatchIcon assetId="asset-aapl" />)

    fireEvent.click(icon())
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

  it("keeps clicks on the icon and its dialog from reaching the row", () => {
    watching([makeWatchlistItem({ asset, targetPrice: 150 })])
    const onRowClick = jest.fn()
    const onRowDoubleClick = jest.fn()
    render(
      <div onClick={onRowClick} onDoubleClick={onRowDoubleClick}>
        <WatchIcon assetId="asset-aapl" />
      </div>,
    )

    fireEvent.click(icon())
    const field = screen.getByLabelText(/Target price/)
    fireEvent.click(field)
    fireEvent.doubleClick(field)

    expect(field).toHaveValue("150")
    expect(onRowClick).not.toHaveBeenCalled()
    expect(onRowDoubleClick).not.toHaveBeenCalled()
  })

  it("does not reopen the editor when an unwatched asset is watched again", () => {
    const item = makeWatchlistItem({ asset, targetPrice: 150 })
    watching([item])
    const { rerender } = render(<WatchIcon assetId="asset-aapl" />)
    fireEvent.click(icon())
    expect(screen.getByLabelText(/Target price/)).toBeInTheDocument()

    watching([])
    rerender(<WatchIcon assetId="asset-aapl" />)
    watching([item])
    rerender(<WatchIcon assetId="asset-aapl" />)

    expect(icon()).toBeInTheDocument()
    expect(screen.queryByLabelText(/Target price/)).not.toBeInTheDocument()
  })
})
