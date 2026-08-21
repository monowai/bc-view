import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import {
  makeAsset,
  makeHoldingGroup,
  makeHoldings,
  makePortfolio,
  makePosition,
} from "@test-fixtures/beancounter"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
  })),
  mutate: jest.fn(),
}))

jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({
    ai: false,
    preview: false,
    admin: false,
    isLoading: false,
  }),
}))

// The popup's own content is covered by SectorWeightingsPopup.test.tsx —
// here we only care that the aggregated page opens it.
jest.mock("@components/features/holdings/SectorWeightingsPopup", () => ({
  __esModule: true,
  default: ({ asset }: { asset: { code: string } }) => (
    <div data-testid="sector-weightings-popup">{asset.code}</div>
  ),
}))

const etf = makeAsset({
  id: "asset-voo",
  code: "VOO",
  name: "Vanguard S&P 500",
  assetCategory: { id: "ETF", name: "ETF" },
})

const holdings = makeHoldings({
  holdingGroups: {
    ETF: makeHoldingGroup({ positions: [makePosition({ asset: etf })] }),
  },
})

// Mutated per test so the same page renders in table and card mode.
let mockViewMode = "table"

jest.mock("@lib/holdings/useHoldingsView", () => ({
  useHoldingsView: (): Record<string, unknown> => ({
    viewMode: mockViewMode,
    setViewMode: jest.fn(),
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

import useSwr from "swr"
import AggregatedHoldings from "@pages/holdings/aggregated"

const AggregatedHoldingsPage = AggregatedHoldings as React.ComponentType<
  Record<string, unknown>
>

const holdingContract = {
  portfolio: makePortfolio(),
  isMixedCurrencies: false,
  asAt: "2026-08-21",
  positions: {},
  totals: {},
}

describe("Aggregated holdings — sector weightings", () => {
  beforeEach(() => {
    ;(useSwr as unknown as jest.Mock).mockImplementation((key: unknown) => {
      if (typeof key === "string" && key.startsWith("/api/holdings/aggregated"))
        return {
          data: { data: holdingContract },
          error: undefined,
          isLoading: false,
          mutate: jest.fn(),
        }
      return {
        data: undefined,
        error: undefined,
        isLoading: false,
        mutate: jest.fn(),
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
    mockViewMode = "table"
  })

  it.each(["table", "cards"])(
    "offers View Sectors on a fund-like holding and opens the popup (%s view)",
    (mode) => {
      mockViewMode = mode
      render(<AggregatedHoldingsPage />)

      // Card groups start collapsed — open the group to reach its cards.
      if (mode === "cards") {
        fireEvent.click(screen.getByRole("button", { name: /^ETF/ }))
      }
      fireEvent.click(screen.getByRole("button", { name: /Actions VOO/i }))
      fireEvent.click(screen.getByRole("button", { name: "View Sectors" }))

      expect(screen.getByTestId("sector-weightings-popup")).toHaveTextContent(
        "VOO",
      )
    },
  )
})
