import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, it } from "@jest/globals"
import AssetClassifyPanel from "@components/features/assets/AssetClassifyPanel"

// The same name exists in two standards — the picker must show it once.
const sectors = {
  data: [
    {
      code: "INFORMATION_TECHNOLOGY",
      name: "Information Technology",
      standard: "USER",
    },
    {
      code: "COMMUNICATION_SERVICES",
      name: "Communication Services",
      standard: "ALPHA",
    },
    {
      code: "INFORMATION_TECHNOLOGY",
      name: "Information Technology",
      standard: "ALPHA",
    },
  ],
}

// `current` are the asset's classification rows returned by
// GET /api/classifications/{assetId} (a list, not a summary object).
function mockFetch(current: unknown[] = []): void {
  global.fetch = jest.fn((url: string) => {
    if (url.includes("/api/classifications/sectors")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(sectors) })
    }
    if (url.includes("/exposures")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: current }),
    })
  }) as unknown as typeof fetch
}

describe("AssetClassifyPanel sector picker", () => {
  beforeEach(() => {
    mockFetch()
  })

  it("de-duplicates a name shared across standards to one selectable chip", async () => {
    render(<AssetClassifyPanel assetId="a1" assetLabel="GOOG" />)

    const itChips = await screen.findAllByRole("button", {
      name: "Information Technology",
    })
    expect(itChips).toHaveLength(1)

    fireEvent.click(itChips[0])

    const pressed = screen.getAllByRole("button", { pressed: true })
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toBe(itChips[0])
  })

  it("shows and pre-selects the asset's current sector on open", async () => {
    mockFetch([
      {
        level: "SECTOR",
        source: "MANUAL",
        standard: { key: "USER" },
        item: {
          code: "INFORMATION_TECHNOLOGY",
          name: "Information Technology",
        },
      },
    ])

    render(<AssetClassifyPanel assetId="a1" assetLabel="GOOG" />)

    expect(await screen.findByText(/Current:/)).toBeInTheDocument()

    const itChip = await screen.findByRole("button", {
      name: "Information Technology",
    })
    const pressed = screen.getAllByRole("button", { pressed: true })
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toBe(itChip)
  })
})
