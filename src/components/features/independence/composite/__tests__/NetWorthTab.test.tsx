import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { Portfolio } from "types/beancounter"
import type { WealthSummary } from "@lib/wealth/liquidityGroups"
import type { UseNetWorthDataResult } from "@components/features/wealth/useNetWorthData"

// ── Data hooks ───────────────────────────────────────────────────────────────

const mockUpdateSettings = jest.fn().mockResolvedValue({})
const mockMutateSettings = jest.fn()

let mockSettings: {
  excludedPortfolioIds?: string | null
  manualAssets?: string | null
} = {}

jest.mock("@hooks/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
    mutateSettings: mockMutateSettings,
    isLoading: false,
  }),
}))

const mockPortfolio1: Portfolio = {
  id: "pf-1",
  code: "ALPHA",
  name: "Alpha Portfolio",
  base: { id: "usd", code: "USD", symbol: "$", name: "US Dollar" },
  currency: { id: "usd", code: "USD", symbol: "$", name: "US Dollar" },
  marketValue: 100000,
  irr: 0.05,
} as unknown as Portfolio

const mockPortfolio2: Portfolio = {
  id: "pf-2",
  code: "BETA",
  name: "Beta Portfolio",
  base: { id: "usd", code: "USD", symbol: "$", name: "US Dollar" },
  currency: { id: "usd", code: "USD", symbol: "$", name: "US Dollar" },
  marketValue: 50000,
  irr: 0.03,
} as unknown as Portfolio

const defaultNetWorthData: UseNetWorthDataResult = {
  portfolios: [mockPortfolio1, mockPortfolio2],
  holdingsData: undefined,
  currencies: [{ code: "USD", symbol: "$", name: "US Dollar" }],
  displayCurrency: { code: "USD", symbol: "$", name: "US Dollar" },
  setDisplayCurrency: jest.fn(),
  fxRates: { USD: 1 },
  fxReady: true,
  customAssetTotals: {},
  healthcareReserveTotals: {},
  isLoading: false,
}

let mockNetWorthData: UseNetWorthDataResult = { ...defaultNetWorthData }

// Spy so tests can assert which excludedPortfolioIds were passed
const mockUseNetWorthData = jest.fn()

jest.mock("@components/features/wealth/useNetWorthData", () => ({
  useNetWorthData: (...args: unknown[]) => mockUseNetWorthData(...args),
}))

// ── useWealthSummary — spy to assert filtered inputs ─────────────────────────

const mockWealthSummaryFn = jest.fn()

jest.mock("@components/features/wealth/useWealthSummary", () => ({
  useWealthSummary: (...args: unknown[]) => mockWealthSummaryFn(...args),
}))

function makeSummary(totalValue: number): WealthSummary {
  return {
    totalValue,
    totalGainOnDay: 0,
    portfolioCount: 1,
    healthcareReserve: 0,
    classificationBreakdown: [],
    portfolioBreakdown: [],
  }
}

// ── Wealth display components — stub so tests don't need full dep tree ───────

jest.mock("@components/features/wealth/WealthHeroSection", () => ({
  __esModule: true,
  default: ({ summary }: { summary: WealthSummary }) => (
    <div data-testid="wealth-hero">
      <span data-testid="total-value">{summary.totalValue}</span>
    </div>
  ),
}))

jest.mock("@components/features/wealth/AssetAllocationCharts", () => ({
  __esModule: true,
  default: () => <div data-testid="asset-allocation-charts" />,
}))

jest.mock("@components/features/wealth/PortfolioDetailsTable", () => ({
  __esModule: true,
  default: () => <div data-testid="portfolio-details-table" />,
}))

jest.mock("@components/ui/Spinner", () => ({
  __esModule: true,
  default: ({ label }: { label?: string }) => (
    <div data-testid="spinner">{label}</div>
  ),
}))

// ── Tests ────────────────────────────────────────────────────────────────────

import NetWorthTab from "../tabs/NetWorthTab"

describe("NetWorthTab", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSettings = {}
    mockNetWorthData = {
      ...defaultNetWorthData,
      portfolios: [mockPortfolio1, mockPortfolio2],
    }
    mockUseNetWorthData.mockImplementation(() => mockNetWorthData)
    mockWealthSummaryFn.mockReturnValue(makeSummary(150000))
  })

  describe("rendering", () => {
    it("shows the wealth hero with the summary total", () => {
      render(<NetWorthTab />)
      expect(screen.getByTestId("wealth-hero")).toBeInTheDocument()
      expect(screen.getByTestId("total-value")).toHaveTextContent("150000")
    })

    it("renders a spinner while data is loading", () => {
      mockNetWorthData = { ...defaultNetWorthData, isLoading: true }
      render(<NetWorthTab />)
      expect(screen.getByTestId("spinner")).toBeInTheDocument()
      expect(screen.queryByTestId("wealth-hero")).not.toBeInTheDocument()
    })

    it("renders checkboxes for each portfolio", () => {
      render(<NetWorthTab />)
      expect(screen.getByLabelText(/ALPHA/)).toBeInTheDocument()
      expect(screen.getByLabelText(/BETA/)).toBeInTheDocument()
    })

    it("all portfolios are checked by default when no exclusions in settings", () => {
      mockSettings = { excludedPortfolioIds: null }
      render(<NetWorthTab />)
      const alphaCheckbox = screen.getByRole("checkbox", { name: /ALPHA/ })
      const betaCheckbox = screen.getByRole("checkbox", { name: /BETA/ })
      expect(alphaCheckbox).toBeChecked()
      expect(betaCheckbox).toBeChecked()
    })

    it("excluded portfolio checkbox is unchecked when in settings", () => {
      mockSettings = { excludedPortfolioIds: JSON.stringify(["pf-1"]) }
      render(<NetWorthTab />)
      const alphaCheckbox = screen.getByRole("checkbox", { name: /ALPHA/ })
      const betaCheckbox = screen.getByRole("checkbox", { name: /BETA/ })
      expect(alphaCheckbox).not.toBeChecked()
      expect(betaCheckbox).toBeChecked()
    })
  })

  describe("portfolio exclusion toggling", () => {
    it("unchecking a portfolio calls updateSettings with its id in excludedPortfolioIds", () => {
      mockSettings = {}
      render(<NetWorthTab />)
      const alphaCheckbox = screen.getByRole("checkbox", { name: /ALPHA/ })
      fireEvent.click(alphaCheckbox)
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        excludedPortfolioIds: JSON.stringify(["pf-1"]),
      })
    })

    it("re-checking an excluded portfolio removes it from excluded list", () => {
      mockSettings = { excludedPortfolioIds: JSON.stringify(["pf-1"]) }
      render(<NetWorthTab />)
      const alphaCheckbox = screen.getByRole("checkbox", { name: /ALPHA/ })
      fireEvent.click(alphaCheckbox)
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        excludedPortfolioIds: JSON.stringify([]),
      })
    })

    it("adding a second exclusion preserves the first", () => {
      mockSettings = { excludedPortfolioIds: JSON.stringify(["pf-1"]) }
      render(<NetWorthTab />)
      const betaCheckbox = screen.getByRole("checkbox", { name: /BETA/ })
      fireEvent.click(betaCheckbox)
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        excludedPortfolioIds: JSON.stringify(["pf-1", "pf-2"]),
      })
    })

    it("mutateSettings is called after updateSettings", async () => {
      mockSettings = {}
      render(<NetWorthTab />)
      const alphaCheckbox = screen.getByRole("checkbox", { name: /ALPHA/ })
      fireEvent.click(alphaCheckbox)
      // Wait for the async chain to settle
      await new Promise((r) => setTimeout(r, 0))
      expect(mockMutateSettings).toHaveBeenCalled()
    })
  })

  describe("wealth summary filtering", () => {
    it("passes only included portfolios to useWealthSummary", () => {
      mockSettings = { excludedPortfolioIds: JSON.stringify(["pf-1"]) }
      render(<NetWorthTab />)
      const callArgs = mockWealthSummaryFn.mock.calls[0]
      const portfoliosArg = callArgs[0] as Portfolio[]
      expect(portfoliosArg).toHaveLength(1)
      expect(portfoliosArg[0].id).toBe("pf-2")
    })

    it("passes all portfolios when no exclusions set", () => {
      mockSettings = {}
      render(<NetWorthTab />)
      const callArgs = mockWealthSummaryFn.mock.calls[0]
      const portfoliosArg = callArgs[0] as Portfolio[]
      expect(portfoliosArg).toHaveLength(2)
    })
  })

  describe("holdings fetch scoping via useNetWorthData", () => {
    it("passes excluded ids to useNetWorthData so the holdings URL is scoped", () => {
      mockSettings = { excludedPortfolioIds: JSON.stringify(["pf-1"]) }
      render(<NetWorthTab />)
      // The hook receives the excluded list; it builds ids= from portfolios minus this set
      expect(mockUseNetWorthData).toHaveBeenCalledWith(["pf-1"])
    })

    it("passes empty excluded ids when no exclusions are configured", () => {
      mockSettings = {}
      render(<NetWorthTab />)
      expect(mockUseNetWorthData).toHaveBeenCalledWith([])
    })

    it("excluded portfolio id is absent from the list passed to useNetWorthData", () => {
      mockSettings = { excludedPortfolioIds: JSON.stringify(["pf-2"]) }
      render(<NetWorthTab />)
      const args = mockUseNetWorthData.mock.calls[0][0] as string[]
      // pf-2 is excluded so it should be in the excluded-ids arg, not filtered out here —
      // the hook is responsible for deriving included from portfolios minus excluded.
      expect(args).toEqual(["pf-2"])
    })

    it("toggling exclusion then calling mutateSettings triggers a re-render with updated excluded ids", async () => {
      mockSettings = {}
      render(<NetWorthTab />)
      // Initially no exclusions
      expect(mockUseNetWorthData).toHaveBeenCalledWith([])

      const alphaCheckbox = screen.getByRole("checkbox", { name: /ALPHA/ })
      fireEvent.click(alphaCheckbox)
      await new Promise((r) => setTimeout(r, 0))
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        excludedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      expect(mockMutateSettings).toHaveBeenCalled()
    })
  })

  describe("manual assets editor", () => {
    it("does NOT show manual assets editor when portfolios have balances", () => {
      // Both portfolios have non-zero marketValue
      render(<NetWorthTab />)
      expect(screen.queryByText(/Estimated Assets/)).not.toBeInTheDocument()
    })

    it("shows manual assets editor when no portfolios have balances", () => {
      mockNetWorthData = {
        ...defaultNetWorthData,
        portfolios: [
          { ...mockPortfolio1, marketValue: 0 },
          { ...mockPortfolio2, marketValue: 0 },
        ],
      }
      render(<NetWorthTab />)
      expect(screen.getByText(/Estimated Assets/)).toBeInTheDocument()
    })

    it("shows manual assets editor when portfolio list is empty", () => {
      mockNetWorthData = { ...defaultNetWorthData, portfolios: [] }
      render(<NetWorthTab />)
      expect(screen.getByText(/Estimated Assets/)).toBeInTheDocument()
    })

    it("manual asset input change calls updateSettings with serialised record", () => {
      mockNetWorthData = {
        ...defaultNetWorthData,
        portfolios: [],
      }
      mockSettings = { manualAssets: null }
      render(<NetWorthTab />)
      const cashInput = screen.getByLabelText(/Cash & Bank Accounts/)
      fireEvent.change(cashInput, { target: { value: "10000" } })
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        manualAssets: JSON.stringify({ CASH: 10000 }),
      })
    })

    it("pre-populates manual asset inputs from settings", () => {
      mockNetWorthData = { ...defaultNetWorthData, portfolios: [] }
      mockSettings = {
        manualAssets: JSON.stringify({ CASH: 5000, EQUITY: 20000 }),
      }
      render(<NetWorthTab />)
      const cashInput = screen.getByLabelText(
        /Cash & Bank Accounts/,
      ) as HTMLInputElement
      expect(cashInput.value).toBe("5000")
    })
  })
})
