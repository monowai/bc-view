import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { SWRConfig } from "swr"
import AssetsPageDefault from "@pages/admin/assets"
import { enrichAsset, getAsset, updateAsset } from "@utils/api/client/assets"

jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({ admin: true, isLoading: false }),
}))

jest.mock("@utils/api/client/assets", () => ({
  enrichAsset: jest.fn(),
  getAsset: jest.fn(),
  updateAsset: jest.fn(),
  updateAssetStatus: jest.fn(),
}))

jest.mock("@components/features/assets/AssetSearch", () => ({
  __esModule: true,
  default: ({
    onSelect,
  }: {
    onSelect: (o: { assetId: string }) => void
  }): React.ReactElement => (
    <button onClick={() => onSelect({ assetId: "a-1" })}>{"pick"}</button>
  ),
}))

const Page = AssetsPageDefault as React.ComponentType

const privateAsset = {
  id: "a-1",
  code: "USER.HOUSE",
  displayCode: "HOUSE",
  name: "House",
  status: "Active",
  market: { code: "PRIVATE", name: "Private" },
  priceSymbol: "USD",
  assetCategory: { id: "RE", name: "Real Estate" },
  expectedReturnRate: 0.05,
}

const replyWith = (data: unknown): Response =>
  ({ ok: true, json: () => Promise.resolve({ data }) }) as unknown as Response

async function pickAsset(): Promise<void> {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Page />
    </SWRConfig>,
  )
  fireEvent.click(screen.getByRole("button", { name: "pick" }))
  await screen.findByRole("button", { name: /Re-enrich/ })
}

describe("asset admin edit fields", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    }) as unknown as typeof fetch
    ;(getAsset as jest.Mock).mockResolvedValue(replyWith(privateAsset))
  })

  it("should fill the form from the loaded asset", async () => {
    await pickAsset()
    expect(screen.getByDisplayValue("House")).toBeInTheDocument()
    expect(screen.getByDisplayValue("5")).toBeInTheDocument()
  })

  it("should refill the form from the asset returned by enrichment", async () => {
    ;(enrichAsset as jest.Mock).mockResolvedValue(
      replyWith({
        ...privateAsset,
        name: "Enriched House",
        expectedReturnRate: null,
      }),
    )
    await pickAsset()
    fireEvent.click(screen.getByRole("button", { name: /Re-enrich/ }))

    expect(
      await screen.findByDisplayValue("Enriched House"),
    ).toBeInTheDocument()
    expect(screen.getByText("Asset enriched successfully")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("e.g. 3.0")).toHaveValue(null)
  })

  it("should refill the form from the asset returned by a save", async () => {
    ;(updateAsset as jest.Mock).mockResolvedValue(
      replyWith({ ...privateAsset, name: "Saved House" }),
    )
    await pickAsset()
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(updateAsset).toHaveBeenCalled())
    expect(await screen.findByDisplayValue("Saved House")).toBeInTheDocument()
    expect(screen.getByText("Asset updated")).toBeInTheDocument()
  })
})
