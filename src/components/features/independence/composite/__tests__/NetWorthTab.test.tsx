import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { Portfolio } from "types/beancounter"
import type { IndependencePlan } from "types/independence"
import type { WealthSummary } from "@lib/wealth/liquidityGroups"
import type { UseNetWorthDataResult } from "@components/features/wealth/useNetWorthData"

// ── The active independence plan (journey) ───────────────────────────────────

const mockUpdate = jest.fn().mockResolvedValue({})

function makePlan(overrides: Partial<IndependencePlan> = {}): IndependencePlan {
  return {
    id: "jrn-1",
    ownerId: "owner-1",
    name: "With Property",
    isPrimary: true,
    createdDate: "2026-01-01",
    updatedDate: "2026-01-01",
    ...overrides,
  }
}

let mockActivePlan: IndependencePlan | undefined = makePlan()

jest.mock("@hooks/useIndependencePlans", () => ({
  useActiveIndependencePlan: () => ({
    plans: mockActivePlan ? [mockActivePlan] : [],
    activePlan: mockActivePlan,
    activePlanId: mockActivePlan?.id,
    setActivePlan: jest.fn(),
    update: mockUpdate,
    isLoading: false,
  }),
}))

// ── Net-worth data ───────────────────────────────────────────────────────────

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

// Spy so tests can assert which excluded ids scope the holdings fetch
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

// ── Helpers ──────────────────────────────────────────────────────────────────

import NetWorthTab from "../tabs/NetWorthTab"

const keep = (code: string): HTMLElement =>
  screen.getByRole("radio", { name: `Keep ${code}` })
const sell = (code: string): HTMLElement =>
  screen.getByRole("radio", { name: `Sell ${code}` })
const exclude = (code: string): HTMLElement =>
  screen.getByRole("radio", { name: `Exclude ${code}` })

/** The single request body the component PATCHed onto the active plan. */
function lastUpdateBody(): Record<string, unknown> {
  const call = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1]
  return call[1] as Record<string, unknown>
}

describe("NetWorthTab", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdate.mockResolvedValue({})
    mockActivePlan = makePlan()
    mockNetWorthData = {
      ...defaultNetWorthData,
      portfolios: [mockPortfolio1, mockPortfolio2],
    }
    mockUseNetWorthData.mockImplementation(() => mockNetWorthData)
    mockWealthSummaryFn.mockReturnValue(makeSummary(150000))
  })

  describe("rendering", () => {
    it("renders the per-portfolio treatment editor as the primary content", () => {
      render(<NetWorthTab />)
      expect(
        screen.getByText(/How each portfolio counts in this plan/),
      ).toBeInTheDocument()
    })

    it("names the plan whose wealth definition is being edited", () => {
      mockActivePlan = makePlan({ name: "No Property" })
      render(<NetWorthTab />)
      expect(screen.getByText(/Wealth for No Property/)).toBeInTheDocument()
    })

    it("renders a spinner while data is loading and hides the editor", () => {
      mockNetWorthData = { ...defaultNetWorthData, isLoading: true }
      render(<NetWorthTab />)
      expect(screen.getByTestId("spinner")).toBeInTheDocument()
      expect(
        screen.queryByText(/How each portfolio counts in this plan/),
      ).not.toBeInTheDocument()
    })

    it("offers keep / sell / exclude for every portfolio", () => {
      render(<NetWorthTab />)
      for (const code of ["ALPHA", "BETA"]) {
        expect(keep(code)).toBeInTheDocument()
        expect(sell(code)).toBeInTheDocument()
        expect(exclude(code)).toBeInTheDocument()
      }
    })
  })

  describe("reading the plan's wealth definition", () => {
    it("a portfolio in neither array reads as Keep", () => {
      render(<NetWorthTab />)
      expect(keep("ALPHA")).toHaveAttribute("aria-checked", "true")
      expect(sell("ALPHA")).toHaveAttribute("aria-checked", "false")
      expect(exclude("ALPHA")).toHaveAttribute("aria-checked", "false")
    })

    it("a portfolio in excludedPortfolioIds reads as Exclude, not Sell", () => {
      mockActivePlan = makePlan({
        excludedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      render(<NetWorthTab />)
      expect(exclude("ALPHA")).toHaveAttribute("aria-checked", "true")
      expect(sell("ALPHA")).toHaveAttribute("aria-checked", "false")
      expect(keep("BETA")).toHaveAttribute("aria-checked", "true")
    })

    it("a portfolio in liquidatedPortfolioIds reads as Sell, not Exclude", () => {
      mockActivePlan = makePlan({
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      render(<NetWorthTab />)
      expect(sell("ALPHA")).toHaveAttribute("aria-checked", "true")
      expect(exclude("ALPHA")).toHaveAttribute("aria-checked", "false")
    })

    it("explains a sold portfolio differently from an ignored one", () => {
      mockActivePlan = makePlan({
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
        excludedPortfolioIds: JSON.stringify(["pf-2"]),
      })
      render(<NetWorthTab />)
      expect(
        screen.getByText(/Sold at the start of this plan/),
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Not part of this plan's wealth at all/),
      ).toBeInTheDocument()
    })
  })

  describe("writing the plan's wealth definition", () => {
    it("Exclude writes the id to excludedPortfolioIds on the active plan", () => {
      render(<NetWorthTab />)
      fireEvent.click(exclude("ALPHA"))
      expect(mockUpdate).toHaveBeenCalledWith("jrn-1", {
        excludedPortfolioIds: JSON.stringify(["pf-1"]),
        liquidatedPortfolioIds: JSON.stringify([]),
      })
    })

    it("Sell writes the id to liquidatedPortfolioIds on the active plan", () => {
      render(<NetWorthTab />)
      fireEvent.click(sell("ALPHA"))
      expect(mockUpdate).toHaveBeenCalledWith("jrn-1", {
        excludedPortfolioIds: JSON.stringify([]),
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
      })
    })

    it("moving Exclude -> Sell leaves excludedPortfolioIds clean", () => {
      mockActivePlan = makePlan({
        excludedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      render(<NetWorthTab />)
      fireEvent.click(sell("ALPHA"))
      expect(lastUpdateBody()).toEqual({
        excludedPortfolioIds: JSON.stringify([]),
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
      })
    })

    it("moving Sell -> Exclude leaves liquidatedPortfolioIds clean", () => {
      mockActivePlan = makePlan({
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      render(<NetWorthTab />)
      fireEvent.click(exclude("ALPHA"))
      expect(lastUpdateBody()).toEqual({
        excludedPortfolioIds: JSON.stringify(["pf-1"]),
        liquidatedPortfolioIds: JSON.stringify([]),
      })
    })

    it("Keep removes the id from both arrays", () => {
      mockActivePlan = makePlan({
        liquidatedPortfolioIds: JSON.stringify(["pf-1", "pf-2"]),
      })
      render(<NetWorthTab />)
      fireEvent.click(keep("ALPHA"))
      expect(lastUpdateBody()).toEqual({
        excludedPortfolioIds: JSON.stringify([]),
        liquidatedPortfolioIds: JSON.stringify(["pf-2"]),
      })
    })

    it("a second exclusion preserves the first, and the other array stays empty", () => {
      mockActivePlan = makePlan({
        excludedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      render(<NetWorthTab />)
      fireEvent.click(exclude("BETA"))
      expect(lastUpdateBody()).toEqual({
        excludedPortfolioIds: JSON.stringify(["pf-1", "pf-2"]),
        liquidatedPortfolioIds: JSON.stringify([]),
      })
    })

    it("selling one portfolio while another stays excluded keeps them apart", () => {
      mockActivePlan = makePlan({
        excludedPortfolioIds: JSON.stringify(["pf-2"]),
      })
      render(<NetWorthTab />)
      fireEvent.click(sell("ALPHA"))
      expect(lastUpdateBody()).toEqual({
        excludedPortfolioIds: JSON.stringify(["pf-2"]),
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
      })
    })

    it("re-picking the state a portfolio is already in saves nothing", () => {
      render(<NetWorthTab />)
      fireEvent.click(keep("ALPHA"))
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it("surfaces a rejected save instead of swallowing it", async () => {
      mockUpdate.mockRejectedValue(new Error("Plan is read-only"))
      render(<NetWorthTab />)
      fireEvent.click(exclude("ALPHA"))
      expect(await screen.findByText("Plan is read-only")).toBeInTheDocument()
    })
  })

  describe("liquidation costs", () => {
    it("is hidden when nothing is being sold", () => {
      mockActivePlan = makePlan({
        excludedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      render(<NetWorthTab />)
      expect(screen.queryByLabelText("Sale costs")).not.toBeInTheDocument()
    })

    it("appears once a portfolio is being sold", () => {
      mockActivePlan = makePlan({
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      render(<NetWorthTab />)
      expect(screen.getByLabelText("Sale costs")).toBeInTheDocument()
    })

    it("shows the stored fraction as a percentage", () => {
      mockActivePlan = makePlan({
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
        liquidationCostsPercent: 0.05,
      })
      render(<NetWorthTab />)
      expect(screen.getByLabelText("Sale costs")).toHaveValue(5)
    })

    it("saves a typed percentage back as a fraction", () => {
      mockActivePlan = makePlan({
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      render(<NetWorthTab />)
      fireEvent.change(screen.getByLabelText("Sale costs"), {
        target: { value: "4" },
      })
      expect(mockUpdate).toHaveBeenCalledWith("jrn-1", {
        liquidationCostsPercent: 0.04,
      })
    })

    it("rejects 100% or more without saving", () => {
      mockActivePlan = makePlan({
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      render(<NetWorthTab />)
      fireEvent.change(screen.getByLabelText("Sale costs"), {
        target: { value: "120" },
      })
      expect(
        screen.getByText(/Sale costs must be at least 0% and under 100%/),
      ).toBeInTheDocument()
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it("rejects a negative percentage without saving", () => {
      mockActivePlan = makePlan({
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      render(<NetWorthTab />)
      fireEvent.change(screen.getByLabelText("Sale costs"), {
        target: { value: "-1" },
      })
      expect(
        screen.getByText(/Sale costs must be at least 0% and under 100%/),
      ).toBeInTheDocument()
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it("surfaces the backend's rejection of an out-of-range fraction", async () => {
      mockActivePlan = makePlan({
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      mockUpdate.mockRejectedValue(
        new Error("liquidationCostsPercent must be between 0 and 1"),
      )
      render(<NetWorthTab />)
      fireEvent.change(screen.getByLabelText("Sale costs"), {
        target: { value: "7" },
      })
      expect(
        await screen.findByText(
          "liquidationCostsPercent must be between 0 and 1",
        ),
      ).toBeInTheDocument()
    })
  })

  describe("holdings breakdown scoping", () => {
    it("drops excluded portfolios from the aggregated-holdings fetch", () => {
      mockActivePlan = makePlan({
        excludedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      render(<NetWorthTab />)
      // useNetWorthData derives ids=<all minus these> for
      // /api/holdings/aggregated — see its own tests.
      expect(mockUseNetWorthData).toHaveBeenCalledWith(["pf-1"])
    })

    it("keeps liquidated portfolios in the aggregated-holdings fetch", () => {
      // Liquidated is still the user's money, as cash — dropping it from ids=
      // would make the charts disagree with the headline.
      mockActivePlan = makePlan({
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      render(<NetWorthTab />)
      expect(mockUseNetWorthData).toHaveBeenCalledWith([])
    })

    it("drops only the excluded one when a plan both sells and excludes", () => {
      mockActivePlan = makePlan({
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
        excludedPortfolioIds: JSON.stringify(["pf-2"]),
      })
      render(<NetWorthTab />)
      expect(mockUseNetWorthData).toHaveBeenCalledWith(["pf-2"])
    })

    it("passes no exclusions when the plan has none", () => {
      render(<NetWorthTab />)
      expect(mockUseNetWorthData).toHaveBeenCalledWith([])
    })
  })

  describe("wealth summary filtering", () => {
    it("excluded portfolios leave the summary", () => {
      mockActivePlan = makePlan({
        excludedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      render(<NetWorthTab />)
      const portfoliosArg = mockWealthSummaryFn.mock.calls[0][0] as Portfolio[]
      expect(portfoliosArg.map((p) => p.id)).toEqual(["pf-2"])
    })

    it("liquidated portfolios stay in the summary", () => {
      mockActivePlan = makePlan({
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
      })
      render(<NetWorthTab />)
      const portfoliosArg = mockWealthSummaryFn.mock.calls[0][0] as Portfolio[]
      expect(portfoliosArg.map((p) => p.id)).toEqual(["pf-1", "pf-2"])
    })
  })

  describe("switching plan", () => {
    it("shows the newly selected plan's wealth definition", () => {
      mockActivePlan = makePlan({
        id: "jrn-1",
        name: "With Property",
        liquidatedPortfolioIds: JSON.stringify([]),
      })
      const { rerender } = render(<NetWorthTab />)
      expect(keep("ALPHA")).toHaveAttribute("aria-checked", "true")

      mockActivePlan = makePlan({
        id: "jrn-2",
        name: "No Property",
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
        liquidationCostsPercent: 0.03,
      })
      rerender(<NetWorthTab />)

      expect(screen.getByText(/Wealth for No Property/)).toBeInTheDocument()
      expect(sell("ALPHA")).toHaveAttribute("aria-checked", "true")
      expect(keep("ALPHA")).toHaveAttribute("aria-checked", "false")
      expect(screen.getByLabelText("Sale costs")).toHaveValue(3)
    })

    it("re-seeds sale costs from the new plan rather than keeping a typed value", () => {
      mockActivePlan = makePlan({
        id: "jrn-1",
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
        liquidationCostsPercent: 0.05,
      })
      const { rerender } = render(<NetWorthTab />)
      fireEvent.change(screen.getByLabelText("Sale costs"), {
        target: { value: "9" },
      })
      expect(screen.getByLabelText("Sale costs")).toHaveValue(9)

      mockActivePlan = makePlan({
        id: "jrn-2",
        liquidatedPortfolioIds: JSON.stringify(["pf-1"]),
        liquidationCostsPercent: 0.02,
      })
      rerender(<NetWorthTab />)
      expect(screen.getByLabelText("Sale costs")).toHaveValue(2)
    })

    it("writes go to the plan now selected", () => {
      mockActivePlan = makePlan({ id: "jrn-1" })
      const { rerender } = render(<NetWorthTab />)
      mockActivePlan = makePlan({ id: "jrn-2" })
      rerender(<NetWorthTab />)
      fireEvent.click(exclude("ALPHA"))
      expect(mockUpdate).toHaveBeenCalledWith("jrn-2", {
        excludedPortfolioIds: JSON.stringify(["pf-1"]),
        liquidatedPortfolioIds: JSON.stringify([]),
      })
    })
  })

  describe("manual assets editor", () => {
    it("does NOT show the manual assets editor when portfolios have balances", () => {
      render(<NetWorthTab />)
      expect(screen.queryByText(/Estimated Assets/)).not.toBeInTheDocument()
    })

    it("shows the manual assets editor when no portfolios have balances", () => {
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

    it("shows the manual assets editor when the portfolio list is empty", () => {
      mockNetWorthData = { ...defaultNetWorthData, portfolios: [] }
      render(<NetWorthTab />)
      expect(screen.getByText(/Estimated Assets/)).toBeInTheDocument()
    })

    it("writes manualAssets to the active plan, not to settings", () => {
      mockNetWorthData = { ...defaultNetWorthData, portfolios: [] }
      render(<NetWorthTab />)
      fireEvent.change(screen.getByLabelText(/Cash & Bank Accounts/), {
        target: { value: "10000" },
      })
      expect(mockUpdate).toHaveBeenCalledWith("jrn-1", {
        manualAssets: JSON.stringify({ CASH: 10000 }),
      })
    })

    it("merges into the plan's existing manual assets", () => {
      mockNetWorthData = { ...defaultNetWorthData, portfolios: [] }
      mockActivePlan = makePlan({
        manualAssets: JSON.stringify({ CASH: 5000, EQUITY: 20000 }),
      })
      render(<NetWorthTab />)
      fireEvent.change(screen.getByLabelText(/ETFs/), {
        target: { value: "1000" },
      })
      expect(mockUpdate).toHaveBeenCalledWith("jrn-1", {
        manualAssets: JSON.stringify({ CASH: 5000, EQUITY: 20000, ETF: 1000 }),
      })
    })

    it("pre-populates manual asset inputs from the plan", () => {
      mockNetWorthData = { ...defaultNetWorthData, portfolios: [] }
      mockActivePlan = makePlan({
        manualAssets: JSON.stringify({ CASH: 5000, EQUITY: 20000 }),
      })
      render(<NetWorthTab />)
      expect(screen.getByLabelText(/Cash & Bank Accounts/)).toHaveValue(5000)
    })
  })

  describe("with no plan to write to", () => {
    it("disables the treatment controls rather than dropping the write", () => {
      mockActivePlan = undefined
      render(<NetWorthTab />)
      expect(keep("ALPHA")).toBeDisabled()
      fireEvent.click(exclude("ALPHA"))
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })
})
