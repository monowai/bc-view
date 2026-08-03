import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import SetPriceDialog from "@components/features/accounts/SetPriceDialog"
import { Asset } from "types/beancounter"
import { pinClock, unpinClock } from "../../../support/pinClock"

const mockAsset = {
  id: "asset-2",
  code: "OWNER:PENSION",
  name: "Pension Policy",
  market: { code: "PRIVATE", currency: { code: "SGD" } },
  assetCategory: { id: "PENSION", name: "Policies" },
} as unknown as Asset

const dateInput = (): HTMLInputElement =>
  document.querySelector('input[type="date"]') as HTMLInputElement

describe("accounts/SetPriceDialog price date", () => {
  afterEach(unpinClock)

  it("seeds the price date with the user's local date, not the UTC date", () => {
    pinClock("2026-08-02T23:00:00Z", +8)

    render(
      <SetPriceDialog
        asset={mockAsset}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    )

    expect(dateInput().value).toBe("2026-08-03")
  })

  it("submits the local date it seeded", async () => {
    pinClock("2026-08-02T23:00:00Z", +8)
    const onSave = jest.fn().mockResolvedValue(undefined)

    render(
      <SetPriceDialog asset={mockAsset} onClose={jest.fn()} onSave={onSave} />,
    )

    fireEvent.change(screen.getByPlaceholderText(/current market value/i), {
      target: { value: "2500" },
    })
    fireEvent.click(screen.getByText("Save"))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith("asset-2", "2026-08-03", "2500"),
    )
  })
})
