import React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import useSwr, { mutate } from "swr"
import AccountsPage from "@pages/accounts"
import { makeAsset } from "@test-fixtures/beancounter"
import { Asset } from "types/beancounter"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn().mockResolvedValue(undefined),
}))

const mockUpdateAsset = jest.fn()
const mockDeleteAsset = jest.fn()
const mockSetAssetSector = jest.fn()
const mockWritePrice = jest.fn()

jest.mock("@utils/api/client/assets", () => ({
  assetsKey: "/api/assets",
  assetsExportUrl: "/api/assets/export",
  deleteAsset: (...a: unknown[]) => mockDeleteAsset(...a),
  importAssets: jest.fn(),
  updateAsset: (...a: unknown[]) => mockUpdateAsset(...a),
}))
jest.mock("@utils/api/client/classifications", () => ({
  sectorsKey: "/api/classifications/sectors",
  setAssetSector: (...a: unknown[]) => mockSetAssetSector(...a),
}))
jest.mock("@utils/api/client/prices", () => ({
  writePrice: (...a: unknown[]) => mockWritePrice(...a),
}))
jest.mock("@utils/api/client/holdings", () => ({
  aggregatedHoldingsTodayKey: "/api/holdings/aggregated",
}))
jest.mock("next/router", () => ({ useRouter: () => ({ push: jest.fn() }) }))

// Dialogs and overview have their own tests; expose just the callbacks the page wires.
jest.mock("@components/features/accounts/OverviewTab", () => ({
  __esModule: true,
  default: (p: { onSelectCategory: (c: string) => void }) => (
    <button onClick={() => p.onSelectCategory("RE")}>
      {"overview-pick-RE"}
    </button>
  ),
}))
jest.mock("@components/features/accounts/AccountActions", () => ({
  __esModule: true,
  default: (p: { onImportClick: () => void }) => (
    <button onClick={p.onImportClick}>{"open-import"}</button>
  ),
}))
jest.mock("@components/features/accounts/EditAccountDialog", () => ({
  __esModule: true,
  default: (p: {
    asset: Asset
    sectors: unknown[]
    onClose: () => void
    onSave: (...a: unknown[]) => Promise<void>
  }) => (
    <div>
      <span>{`editing ${p.asset.name}`}</span>
      <button
        onClick={() =>
          p.onSave("a1", "CODE", "New Name", "USD", "RE", "Tech", 0.05)
        }
      >
        {"save-with-sector"}
      </button>
      <button
        onClick={() =>
          p.onSave("a1", "CODE", "New Name", "USD", "RE").catch(() => {})
        }
      >
        {"save-no-sector"}
      </button>
      <button onClick={p.onClose}>{"close-edit"}</button>
    </div>
  ),
}))
jest.mock("@components/features/accounts/DeleteAccountDialog", () => ({
  __esModule: true,
  default: (p: {
    asset: Asset
    onClose: () => void
    onConfirm: (id: string) => Promise<void>
  }) => (
    <div>
      <span>{`deleting ${p.asset.name}`}</span>
      <button onClick={() => p.onConfirm("a1").catch(() => {})}>
        {"confirm-delete"}
      </button>
      <button onClick={p.onClose}>{"close-delete"}</button>
    </div>
  ),
}))
jest.mock("@components/features/assets/SetPriceDialog", () => ({
  __esModule: true,
  default: (p: {
    asset: Asset
    onClose: () => void
    onSave: (id: string, d: string, price: string) => Promise<void>
  }) => (
    <div>
      <span>{`pricing ${p.asset.name}`}</span>
      <button
        onClick={() => p.onSave("a1", "2026-01-02", "12.5").catch(() => {})}
      >
        {"save-price"}
      </button>
      <button onClick={p.onClose}>{"close-price"}</button>
    </div>
  ),
}))
jest.mock("@components/features/accounts/SetAccountBalancesDialog", () => ({
  __esModule: true,
  default: (p: {
    asset: Asset
    onClose: () => void
    onComplete: () => void
  }) => (
    <div>
      <span>{`balances ${p.asset.name}`}</span>
      <button onClick={p.onComplete}>{"complete-balances"}</button>
      <button onClick={p.onClose}>{"close-balances"}</button>
    </div>
  ),
}))
jest.mock("@components/features/holdings/SetBalanceDialog", () => ({
  __esModule: true,
  default: (p: {
    asset: Asset
    onClose: () => void
    onComplete: () => void
  }) => (
    <div>
      <span>{`balance ${p.asset.name}`}</span>
      <button onClick={p.onComplete}>{"complete-balance"}</button>
      <button onClick={p.onClose}>{"close-balance"}</button>
    </div>
  ),
}))
jest.mock("@components/ui/CsvImportDialog", () => ({
  __esModule: true,
  default: (p: { onClose: () => void; onComplete: () => void }) => (
    <div>
      <span>{"import dialog"}</span>
      <button onClick={p.onComplete}>{"complete-import"}</button>
      <button onClick={p.onClose}>{"close-import"}</button>
    </div>
  ),
}))

const bank = makeAsset({
  id: "a1",
  code: "BANK",
  name: "Savings",
  displayCode: "BANK",
  assetCategory: { id: "ACCOUNT", name: "Bank Account" },
})
const house = makeAsset({
  id: "a2",
  code: "HOME",
  name: "Family Home",
  displayCode: "HOME",
  assetCategory: { id: "RE", name: "Real Estate" },
})
const pension = makeAsset({
  id: "a3",
  code: "PEN",
  name: "Pension Pot",
  displayCode: "PEN",
  assetCategory: { id: "POLICY", name: "Policy" },
})

interface SwrState {
  assets?: unknown
  error?: unknown
  loading?: boolean
}
function setSwr({ assets, error, loading }: SwrState = {}): void {
  ;(useSwr as jest.Mock).mockImplementation((key: string) => {
    if (key === "/api/assets") {
      return { data: assets, error, isLoading: !!loading }
    }
    if (key.endsWith("/currencies")) {
      return {
        data: { data: [{ code: "USD", name: "US Dollar", symbol: "$" }] },
        isLoading: false,
      }
    }
    if (key.endsWith("/categories")) {
      return {
        data: {
          data: [
            { id: "ACCOUNT", name: "Bank Account" },
            { id: "RE", name: "Real Estate" },
            { id: "POLICY", name: "Policy" },
            { id: "EQUITY", name: "Equity" },
          ],
        },
        isLoading: false,
      }
    }
    return {
      data: { data: [{ code: "T", name: "Tech", standard: "GICS" }] },
      isLoading: false,
    }
  })
}

const rows = (): HTMLElement => screen.getAllByRole("table")[0]

describe("Custom Assets page", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "error").mockImplementation(() => {})
    setSwr({ assets: { data: { a1: bank, a2: house, a3: pension } } })
    mockUpdateAsset.mockResolvedValue({ ok: true })
    mockDeleteAsset.mockResolvedValue({ ok: true })
    mockSetAssetSector.mockResolvedValue(undefined)
    mockWritePrice.mockResolvedValue({ ok: true })
  })
  afterEach(() => jest.restoreAllMocks())

  it("shows the loader while data is loading", () => {
    setSwr({ loading: true })
    render(<AccountsPage />)
    expect(screen.getByTestId("loading")).toBeInTheDocument()
  })

  it("shows an error alert when assets fail to load", () => {
    setSwr({ error: new Error("x") })
    render(<AccountsPage />)
    expect(screen.getByText("Error loading custom assets")).toBeInTheDocument()
  })

  it("shows tabs with counts for user asset categories only", () => {
    render(<AccountsPage />)
    expect(screen.getByRole("button", { name: "Overview" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "All 3" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Real Estate 1" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Equity/ }),
    ).not.toBeInTheDocument()
  })

  it("lists every asset on the All tab and filters by category", async () => {
    const user = userEvent.setup()
    render(<AccountsPage />)
    await user.click(screen.getByRole("button", { name: "All 3" }))
    expect(within(rows()).getByText("Savings")).toBeInTheDocument()
    expect(within(rows()).getByText("Family Home")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Real Estate 1" }))
    expect(within(rows()).getByText("Family Home")).toBeInTheDocument()
    expect(within(rows()).queryByText("Savings")).not.toBeInTheDocument()
  })

  it("navigates to a category from the overview", async () => {
    const user = userEvent.setup()
    render(<AccountsPage />)
    await user.click(screen.getByText("overview-pick-RE"))
    expect(within(rows()).getByText("Family Home")).toBeInTheDocument()
  })

  it("explains an empty category and an empty All tab", async () => {
    setSwr({ assets: { data: {} } })
    const user = userEvent.setup()
    render(<AccountsPage />)
    await user.click(screen.getByRole("button", { name: "All 0" }))
    expect(
      screen.getByText(
        "You have no custom assets. Click Add Asset to create one.",
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Real Estate 0" }))
    expect(screen.getByText("No Real Estate assets yet.")).toBeInTheDocument()
  })

  describe("edit", () => {
    async function openEdit(): Promise<ReturnType<typeof userEvent.setup>> {
      const user = userEvent.setup()
      render(<AccountsPage />)
      await user.click(screen.getByRole("button", { name: "Real Estate 1" }))
      await user.click(within(rows()).getByRole("button", { name: /Edit/ }))
      return user
    }

    it("saves the asset, sector and refreshes the list", async () => {
      const user = await openEdit()
      expect(screen.getByText("editing Family Home")).toBeInTheDocument()
      await user.click(screen.getByText("save-with-sector"))
      await waitFor(() =>
        expect(mockUpdateAsset).toHaveBeenCalledWith("a1", {
          market: "PRIVATE",
          code: "CODE",
          name: "New Name",
          currency: "USD",
          category: "RE",
          expectedReturnRate: 0.05,
        }),
      )
      expect(mockSetAssetSector).toHaveBeenCalledWith("a1", "Tech")
      await waitFor(() =>
        expect(screen.queryByText(/editing/)).not.toBeInTheDocument(),
      )
      expect(mutate).toHaveBeenCalledWith("/api/assets")
    })

    it("skips the sector call when none is chosen", async () => {
      const user = await openEdit()
      await user.click(screen.getByText("save-no-sector"))
      await waitFor(() => expect(mockUpdateAsset).toHaveBeenCalled())
      expect(mockSetAssetSector).not.toHaveBeenCalled()
    })

    it("still closes when only the sector update fails", async () => {
      mockSetAssetSector.mockRejectedValue(new Error("sector down"))
      const user = await openEdit()
      await user.click(screen.getByText("save-with-sector"))
      await waitFor(() =>
        expect(screen.queryByText(/editing/)).not.toBeInTheDocument(),
      )
    })

    it("keeps the dialog open when the update is rejected", async () => {
      mockUpdateAsset.mockResolvedValue({ ok: false })
      const user = await openEdit()
      await user.click(screen.getByText("save-no-sector"))
      await waitFor(() => expect(console.error).toHaveBeenCalled())
      expect(screen.getByText("editing Family Home")).toBeInTheDocument()
    })

    it("closes without saving", async () => {
      const user = await openEdit()
      await user.click(screen.getByText("close-edit"))
      expect(screen.queryByText(/editing/)).not.toBeInTheDocument()
      expect(mockUpdateAsset).not.toHaveBeenCalled()
    })
  })

  describe("delete", () => {
    async function openDelete(): Promise<ReturnType<typeof userEvent.setup>> {
      const user = userEvent.setup()
      render(<AccountsPage />)
      await user.click(screen.getByRole("button", { name: "Real Estate 1" }))
      await user.click(within(rows()).getByRole("button", { name: /Delete/ }))
      return user
    }

    it("deletes and invalidates the asset list and holdings", async () => {
      const user = await openDelete()
      await user.click(screen.getByText("confirm-delete"))
      await waitFor(() =>
        expect(screen.queryByText(/deleting/)).not.toBeInTheDocument(),
      )
      expect(mockDeleteAsset).toHaveBeenCalledWith("a1")
      expect(mutate).toHaveBeenCalledWith("/api/assets")
      expect(mutate).toHaveBeenCalledWith("/api/holdings/aggregated")
    })

    it("keeps the dialog open and logs the server's message on failure", async () => {
      mockDeleteAsset.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Asset has transactions" }),
      })
      const user = await openDelete()
      await user.click(screen.getByText("confirm-delete"))
      await waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          "Error deleting asset:",
          "Asset has transactions",
        ),
      )
      expect(screen.getByText(/deleting/)).toBeInTheDocument()
    })

    it("falls back to a generic message when the error body is unreadable", async () => {
      mockDeleteAsset.mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("bad json")),
      })
      const user = await openDelete()
      await user.click(screen.getByText("confirm-delete"))
      await waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          "Error deleting asset:",
          "Failed to delete asset",
        ),
      )
    })

    it("closes without deleting", async () => {
      const user = await openDelete()
      await user.click(screen.getByText("close-delete"))
      expect(screen.queryByText(/deleting/)).not.toBeInTheDocument()
    })
  })

  describe("price, balances and import", () => {
    it("sets a price for a non-account asset", async () => {
      const user = userEvent.setup()
      render(<AccountsPage />)
      await user.click(screen.getByRole("button", { name: "Real Estate 1" }))
      await user.click(
        within(rows()).getByRole("button", { name: /Set Price/ }),
      )
      expect(screen.getByText("pricing Family Home")).toBeInTheDocument()
      await user.click(screen.getByText("save-price"))
      await waitFor(() =>
        expect(screen.queryByText(/pricing/)).not.toBeInTheDocument(),
      )
      expect(mockWritePrice).toHaveBeenCalledWith({
        assetId: "a1",
        date: "2026-01-02",
        closePrice: 12.5,
      })
    })

    it("keeps the price dialog open when the price write fails", async () => {
      mockWritePrice.mockResolvedValue({ ok: false })
      const user = userEvent.setup()
      render(<AccountsPage />)
      await user.click(screen.getByRole("button", { name: "Real Estate 1" }))
      await user.click(
        within(rows()).getByRole("button", { name: /Set Price/ }),
      )
      await user.click(screen.getByText("save-price"))
      await waitFor(() => expect(console.error).toHaveBeenCalled())
      expect(screen.getByText(/pricing/)).toBeInTheDocument()
    })

    it("closes the price dialog", async () => {
      const user = userEvent.setup()
      render(<AccountsPage />)
      await user.click(screen.getByRole("button", { name: "Real Estate 1" }))
      await user.click(
        within(rows()).getByRole("button", { name: /Set Price/ }),
      )
      await user.click(screen.getByText("close-price"))
      expect(screen.queryByText(/pricing/)).not.toBeInTheDocument()
    })

    it("opens and completes the account balances dialog", async () => {
      const user = userEvent.setup()
      render(<AccountsPage />)
      await user.click(screen.getByRole("button", { name: "Bank Account 1" }))
      await user.click(
        within(rows()).getByRole("button", { name: /Set Balances/ }),
      )
      expect(screen.getByText("balances Savings")).toBeInTheDocument()
      await user.click(screen.getByText("complete-balances"))
      expect(screen.queryByText(/balances Savings/)).not.toBeInTheDocument()
      await user.click(
        within(rows()).getByRole("button", { name: /Set Balances/ }),
      )
      await user.click(screen.getByText("close-balances"))
      expect(screen.queryByText(/balances Savings/)).not.toBeInTheDocument()
    })

    it("opens the policy balance dialog and refreshes on completion", async () => {
      const user = userEvent.setup()
      render(<AccountsPage />)
      await user.click(screen.getByRole("button", { name: "Policy 1" }))
      await user.click(
        within(rows()).getByRole("button", { name: /Set Balance$/ }),
      )
      expect(screen.getByText("balance Pension Pot")).toBeInTheDocument()
      await user.click(screen.getByText("complete-balance"))
      await waitFor(() =>
        expect(screen.queryByText(/balance Pension/)).not.toBeInTheDocument(),
      )
      expect(mutate).toHaveBeenCalledWith("/api/assets")
      await user.click(
        within(rows()).getByRole("button", { name: /Set Balance$/ }),
      )
      await user.click(screen.getByText("close-balance"))
      expect(screen.queryByText(/balance Pension/)).not.toBeInTheDocument()
    })

    it("imports assets and refreshes the list", async () => {
      const user = userEvent.setup()
      render(<AccountsPage />)
      await user.click(screen.getByText("open-import"))
      expect(screen.getByText("import dialog")).toBeInTheDocument()
      await user.click(screen.getByText("complete-import"))
      await waitFor(() =>
        expect(screen.queryByText("import dialog")).not.toBeInTheDocument(),
      )
      expect(mutate).toHaveBeenCalledWith("/api/assets")
      await user.click(screen.getByText("open-import"))
      await user.click(screen.getByText("close-import"))
      expect(screen.queryByText("import dialog")).not.toBeInTheDocument()
    })
  })
})
