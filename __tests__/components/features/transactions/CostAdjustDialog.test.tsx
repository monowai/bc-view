import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import CostAdjustDialog from "@components/features/transactions/CostAdjustDialog"
import SetPriceDialog from "@components/features/assets/SetPriceDialog"
import { Asset, Currency } from "types/beancounter"
import { pinClock, unpinClock } from "../../../support/pinClock"

const asset = {
  id: "asset-1",
  displayCode: "HOUSE",
  name: "Family Home",
  market: { code: "PRIVATE", currency: { code: "SGD" } },
  assetCategory: { id: "RE", name: "Real Estate" },
} as unknown as Asset

const unlabelled = {
  ...asset,
  assetCategory: { id: "NEW", name: "New Category" },
} as unknown as Asset
const uncategorised = { ...asset, assetCategory: undefined } as unknown as Asset

const currency = { code: "SGD", symbol: "S$" } as Currency

const costDialog = (dialogAsset: Asset, onSave = jest.fn()): HTMLElement =>
  render(
    <CostAdjustDialog
      asset={dialogAsset}
      portfolioId="p1"
      currentCostBasis={1000}
      currency={currency}
      onClose={jest.fn()}
      onSave={onSave}
    />,
  ).container

const priceDialog = (dialogAsset: Asset): HTMLElement =>
  render(
    <SetPriceDialog
      asset={dialogAsset}
      onClose={jest.fn()}
      onSave={jest.fn()}
    />,
  ).container

describe("asset value dialogs", () => {
  beforeEach(() => pinClock("2026-08-02T12:00:00Z", +8))
  afterEach(unpinClock)

  it("renders the cost adjust dialog", () => {
    expect(costDialog(asset).innerHTML).toMatchSnapshot()
  })

  it("renders the set price dialog", () => {
    expect(priceDialog(asset).innerHTML).toMatchSnapshot()
  })

  it("maps the category id to its label in both dialogs", () => {
    costDialog(asset)
    priceDialog(asset)
    expect(screen.getAllByText("HOUSE - Real Estate")).toHaveLength(2)
  })

  it("falls back to the category name in both dialogs", () => {
    costDialog(unlabelled)
    priceDialog(unlabelled)
    expect(screen.getAllByText("HOUSE - New Category")).toHaveLength(2)
  })

  it("shows a dash for a missing category only on set price", () => {
    priceDialog(uncategorised)
    expect(screen.getByText("HOUSE - -")).toBeInTheDocument()
  })

  it("shows nothing for a missing category on cost adjust", () => {
    costDialog(uncategorised)
    expect(screen.getByText("HOUSE -")).toBeInTheDocument()
  })

  it("saves the difference from the current cost basis", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    costDialog(asset, onSave)
    fireEvent.change(screen.getByPlaceholderText("1000.00"), {
      target: { value: "1250" },
    })
    fireEvent.click(screen.getByText("Save"))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith("asset-1", "p1", "2026-08-02", 250),
    )
  })

  it("keeps save disabled on cost adjust until the basis changes", () => {
    costDialog(asset)
    expect(screen.getByText("Save").closest("button")).toBeDisabled()
  })
})
