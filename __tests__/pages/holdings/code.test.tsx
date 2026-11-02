import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import {
  makeAsset,
  makeHoldingGroup,
  makeHoldings,
  makePortfolio,
  makePosition,
} from "@test-fixtures/beancounter"
import { Asset } from "types/beancounter"

const mockRouterQuery: Record<string, string> = { code: "TEST" }

jest.mock("next/router", () => ({
  useRouter: (): Record<string, unknown> => ({
    query: mockRouterQuery,
    isReady: true,
    asPath: "/holdings/TEST",
    pathname: "/holdings/[code]",
    push: jest.fn(),
    replace: jest.fn(),
    events: { on: jest.fn(), off: jest.fn() },
  }),
}))

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
}))

let mockAdmin = false
jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({
    ai: false,
    preview: false,
    admin: mockAdmin,
    isLoading: false,
  }),
}))

jest.mock("@utils/api/client/assets", () => ({
  ...jest.requireActual("@utils/api/client/assets"),
  updateAsset: jest.fn(),
}))
jest.mock("@utils/api/client/classifications", () => ({
  ...jest.requireActual("@utils/api/client/classifications"),
  setAssetSector: jest.fn(),
}))

jest.mock("@components/features/accounts/EditAccountDialog", () => ({
  __esModule: true,
  default: ({
    asset,
    onSave,
    onClose,
  }: {
    asset: Asset
    onSave: (...args: unknown[]) => Promise<void>
    onClose: () => void
  }) => (
    <div data-testid="edit-account-dialog">
      {asset.code}
      <button
        onClick={() =>
          onSave(asset.id, "CODE", "Name", "USD", "RE", "Tech", 0.05).catch(
            () => undefined,
          )
        }
      >
        save-edit
      </button>
      <button onClick={onClose}>close-edit</button>
    </div>
  ),
}))

jest.mock("@components/features/admin/AdminAssetEditDialog", () => ({
  __esModule: true,
  default: ({
    asset,
    onSaved,
  }: {
    asset: Asset
    onSaved: () => Promise<void>
  }) => (
    <div data-testid="admin-edit-dialog">
      {asset.code}
      <button onClick={() => onSaved()}>save-admin</button>
    </div>
  ),
}))

const publicAsset = makeAsset({ id: "asset-voo", code: "VOO", name: "VOO" })
const privateAsset = makeAsset({
  id: "asset-home",
  code: "HOME",
  displayCode: "HOME",
  name: "Home",
  market: {
    code: "PRIVATE",
    name: "Private",
    currency: { code: "USD", name: "US Dollar", symbol: "$" },
  },
})

const holdings = makeHoldings({
  holdingGroups: {
    Equity: makeHoldingGroup({
      positions: [
        makePosition({ asset: publicAsset }),
        makePosition({ asset: privateAsset }),
      ],
    }),
  },
})

let mockViewMode = "table"
const mockSetViewMode = jest.fn()

jest.mock("@lib/holdings/useHoldingsView", () => ({
  useHoldingsView: (): Record<string, unknown> => ({
    viewMode: mockViewMode,
    setViewMode: mockSetViewMode,
    sortConfig: { key: "assetName", direction: "asc" },
    allocationGroupBy: "assetClass",
    excludedCategories: new Set<string>(),
    handleSort: jest.fn(),
    handleToggleCategory: jest.fn(),
    holdings,
    allocationData: [],
    allocationTotalValue: 0,
  }),
}))

import useSwr, { mutate as globalMutate } from "swr"
import { assetsKey, updateAsset } from "@utils/api/client/assets"
import { sectorsKey, setAssetSector } from "@utils/api/client/classifications"
import Holdings from "@pages/holdings/[code]"

const HoldingsPage = Holdings as React.ComponentType<Record<string, unknown>>

const holdingContract = {
  portfolio: makePortfolio(),
  isMixedCurrencies: false,
  asAt: "2026-08-21",
  positions: { one: makePosition({ asset: publicAsset }) },
  totals: {},
}

describe("Holdings page", () => {
  const holdingsMutate = jest.fn()

  beforeEach(() => {
    mockAdmin = false
    mockViewMode = "table"
    holdingsMutate.mockResolvedValue(undefined)
    ;(useSwr as unknown as jest.Mock).mockImplementation((key: unknown) => ({
      data:
        typeof key === "string" && key.startsWith("/api/holdings/")
          ? { data: holdingContract }
          : undefined,
      error: undefined,
      isLoading: false,
      mutate: holdingsMutate,
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const openEditAsset = (code: string): void => {
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`Actions ${code}`, "i") }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Edit Asset" }))
  }

  const fetchedKeys = (): unknown[] =>
    (useSwr as unknown as jest.Mock).mock.calls.map(([key]) => key)

  describe("editing an asset", () => {
    it("fetches reference data only once the owner dialog is open", async () => {
      render(<HoldingsPage />)
      expect(fetchedKeys()).not.toContain(sectorsKey)

      openEditAsset("HOME")

      expect(
        await screen.findByTestId("edit-account-dialog"),
      ).toHaveTextContent("HOME")
      expect(fetchedKeys()).toContain(sectorsKey)
    })

    it("saves a private asset, then refreshes holdings and the assets list", async () => {
      ;(updateAsset as jest.Mock).mockResolvedValue({ ok: true })
      render(<HoldingsPage />)
      openEditAsset("HOME")

      fireEvent.click(await screen.findByText("save-edit"))

      await waitFor(() =>
        expect(
          screen.queryByTestId("edit-account-dialog"),
        ).not.toBeInTheDocument(),
      )
      expect(updateAsset).toHaveBeenCalledWith("asset-home", {
        market: "PRIVATE",
        code: "CODE",
        name: "Name",
        currency: "USD",
        category: "RE",
        expectedReturnRate: 0.05,
      })
      expect(setAssetSector).toHaveBeenCalledWith("asset-home", "Tech")
      expect(holdingsMutate).toHaveBeenCalled()
      expect(globalMutate).toHaveBeenCalledWith(assetsKey)
    })

    it("keeps the dialog open when the save is rejected", async () => {
      ;(updateAsset as jest.Mock).mockResolvedValue({ ok: false })
      render(<HoldingsPage />)
      openEditAsset("HOME")

      fireEvent.click(await screen.findByText("save-edit"))

      await waitFor(() => expect(updateAsset).toHaveBeenCalled())
      expect(screen.getByTestId("edit-account-dialog")).toBeInTheDocument()
      expect(holdingsMutate).not.toHaveBeenCalled()
    })

    it("ignores a public asset for a non-admin", () => {
      render(<HoldingsPage />)
      openEditAsset("VOO")

      expect(screen.queryByTestId("admin-edit-dialog")).not.toBeInTheDocument()
      expect(
        screen.queryByTestId("edit-account-dialog"),
      ).not.toBeInTheDocument()
    })

    it("sends an admin's public-asset edit through the slim dialog", async () => {
      mockAdmin = true
      render(<HoldingsPage />)
      openEditAsset("VOO")

      fireEvent.click(await screen.findByText("save-admin"))

      await waitFor(() =>
        expect(
          screen.queryByTestId("admin-edit-dialog"),
        ).not.toBeInTheDocument(),
      )
      expect(holdingsMutate).toHaveBeenCalled()
      expect(globalMutate).toHaveBeenCalledWith(assetsKey)
    })
  })

  describe("table sections", () => {
    it("remembers a collapsed section across a change of view", () => {
      const { rerender } = render(<HoldingsPage />)

      fireEvent.click(
        screen.getAllByRole("button", { name: "Collapse section" })[0],
      )
      expect(
        screen.getByRole("button", { name: "Expand section" }),
      ).toBeInTheDocument()

      mockViewMode = "income"
      rerender(<HoldingsPage />)
      mockViewMode = "table"
      rerender(<HoldingsPage />)

      expect(
        screen.getByRole("button", { name: "Expand section" }),
      ).toBeInTheDocument()
    })
  })
})
