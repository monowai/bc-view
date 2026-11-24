import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import EditWatchlistItemDialog from "../EditWatchlistItemDialog"
import { makeAsset, makeWatchlistItem } from "@test-fixtures/beancounter"
import { formatDate } from "@lib/formatters"
import type { WatchlistItem } from "types/beancounter"

const asset = makeAsset({ id: "asset-meta", code: "META" })

function renderDialog(
  item: WatchlistItem,
  onSubmit: jest.Mock = jest.fn(),
): void {
  render(
    <EditWatchlistItemDialog
      item={item}
      onSubmit={onSubmit}
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

describe("EditWatchlistItemDialog quick-set target", () => {
  const priced = makeWatchlistItem({
    asset,
    price: 597.6,
    addedPrice: 600,
    targetPrice: 632,
  })
  const target = (): HTMLElement => screen.getByLabelText(/Target price/)

  it("sets the target to the latest close", () => {
    renderDialog(priced)
    fireEvent.click(
      screen.getByRole("button", { name: "Set target to the latest close" }),
    )
    expect(target()).toHaveValue("597.60")
  })

  it("sets a stop-loss target a percentage below the latest close", () => {
    renderDialog(priced)
    fireEvent.click(
      screen.getByRole("button", {
        name: "Set target 5% below the latest close",
      }),
    )
    expect(target()).toHaveValue("567.72")
    fireEvent.click(
      screen.getByRole("button", {
        name: "Set target 10% below the latest close",
      }),
    )
    expect(target()).toHaveValue("537.84")
  })

  it("saves the quick-set target", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    renderDialog(priced, onSubmit)
    fireEvent.click(
      screen.getByRole("button", {
        name: "Set target 10% below the latest close",
      }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ targetPrice: 537.84 }),
    )
  })

  it("offers no quick-set without a latest close", () => {
    renderDialog(makeWatchlistItem({ asset, price: null }))
    expect(
      screen.queryByRole("button", { name: /latest close/ }),
    ).not.toBeInTheDocument()
  })
})
