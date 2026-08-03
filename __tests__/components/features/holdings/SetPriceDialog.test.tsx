import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import SetPriceDialog from "@components/features/holdings/SetPriceDialog"
import { Asset } from "types/beancounter"
import { pinClock, unpinClock } from "../../../support/pinClock"

const mockAsset = {
  id: "asset-1",
  code: "OWNER:HOUSE",
  name: "Family Home",
  market: { code: "PRIVATE", currency: { code: "SGD" } },
  assetCategory: { id: "RE", name: "Real Estate" },
} as unknown as Asset

const dateInput = (): HTMLInputElement =>
  document.querySelector('input[type="date"]') as HTMLInputElement

describe("holdings/SetPriceDialog price date", () => {
  afterEach(unpinClock)

  // 23:00 UTC on 2 Aug is already 07:00 on 3 Aug in Singapore (UTC+8).
  // The backend resolves "today" in Asia/Singapore, so seeding the UTC date
  // would write the price against the wrong day.
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
      target: { value: "1500" },
    })
    fireEvent.click(screen.getByText("Save"))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith("asset-1", "2026-08-03", "1500"),
    )
  })
})
