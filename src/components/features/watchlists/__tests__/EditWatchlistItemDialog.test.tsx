import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import EditWatchlistItemDialog from "../EditWatchlistItemDialog"
import { makeAsset, makeWatchlistItem } from "@test-fixtures/beancounter"
import { formatDate } from "@lib/formatters"
import type { WatchlistItem } from "types/beancounter"

const asset = makeAsset({ id: "asset-meta", code: "META" })

function renderDialog(item: WatchlistItem): void {
  render(
    <EditWatchlistItemDialog
      item={item}
      onSubmit={jest.fn()}
      onClose={jest.fn()}
    />,
  )
}

describe("EditWatchlistItemDialog target details", () => {
  it("shows the latest close and how far it is off the target", () => {
    renderDialog(
      makeWatchlistItem({
        asset,
        price: 597.6,
        targetPrice: 632,
        toTarget: 0.0576,
      }),
    )

    expect(screen.getByTestId("target-details")).toHaveTextContent(
      "Last close USD 597.60 · Price is off by 5.76%",
    )
  })

  it("shows when the target was hit", () => {
    renderDialog(
      makeWatchlistItem({ asset, targetHitOn: "2026-11-09", toTarget: 0.01 }),
    )

    expect(screen.getByTestId("target-hit")).toHaveTextContent(
      `Target hit ${formatDate("2026-11-09")}`,
    )
  })

  it("shows only the close when no target is set", () => {
    renderDialog(
      makeWatchlistItem({
        asset,
        price: 120,
        targetPrice: null,
        toTarget: null,
        targetHitOn: null,
      }),
    )

    expect(screen.getByTestId("target-details")).toHaveTextContent(
      /^Last close USD 120\.00$/,
    )
    expect(screen.queryByTestId("target-hit")).not.toBeInTheDocument()
  })

  it("shows no details when the asset has no price", () => {
    renderDialog(
      makeWatchlistItem({
        asset,
        price: null,
        toTarget: null,
        targetHitOn: null,
      }),
    )

    expect(screen.queryByTestId("target-details")).not.toBeInTheDocument()
  })
})
