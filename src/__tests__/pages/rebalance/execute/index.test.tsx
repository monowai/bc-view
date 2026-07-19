import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import ExecuteRebalancePage from "@pages/rebalance/execute/index"
import { useRebalanceExecution } from "@hooks/useRebalanceExecution"
import type {
  DisplayItem,
  UseRebalanceExecutionResult,
} from "@hooks/useRebalanceExecution"
import type { ExecutionDto } from "types/rebalance"

// --- Mocks ---

jest.mock("@hooks/useRebalanceExecution")
const mockUseRebalanceExecution = useRebalanceExecution as jest.Mock

jest.mock("next/router", () => ({
  useRouter: () => ({
    query: { executionId: "exec-1" },
    replace: jest.fn(),
    back: jest.fn(),
    push: jest.fn(),
  }),
}))

// PriceChartPopup and AssetInsightPopup are heavy (recharts / SSE streaming)
// and already covered by their own test suites — stand in with prop-capturing
// stubs so this page test only asserts wiring (correct asset/prompt passed).
jest.mock("@components/features/holdings/PriceChartPopup", () => {
  return function MockPriceChartPopup(props: {
    asset: { id: string; code: string }
    portfolioId?: string
    onClose: () => void
  }) {
    return (
      <div data-testid="price-chart-popup">
        <span data-testid="chart-asset-id">{props.asset.id}</span>
        <span data-testid="chart-asset-code">{props.asset.code}</span>
        <button onClick={props.onClose}>{"close-chart"}</button>
      </div>
    )
  }
})

jest.mock("@components/features/rebalance/models/AssetInsightPopup", () => {
  return function MockAssetInsightPopup(props: {
    asset: { assetCode?: string; assetId: string }
    promptOverride?: { query: string; context: Record<string, unknown> }
    onClose: () => void
  }) {
    return (
      <div data-testid="asset-insight-popup">
        <span data-testid="insight-asset-code">
          {props.asset.assetCode || props.asset.assetId}
        </span>
        <pre data-testid="insight-query">{props.promptOverride?.query}</pre>
        <button onClick={props.onClose}>{"close-insight"}</button>
      </div>
    )
  }
})

// --- Fixtures ---

function makeItem(overrides: Partial<DisplayItem> = {}): DisplayItem {
  const excluded = overrides.excluded ?? false
  return {
    id: overrides.id ?? "item-1",
    assetId: overrides.assetId ?? "asset-1",
    assetCode: overrides.assetCode ?? "AAPL",
    assetName: overrides.assetName ?? "Apple Inc",
    snapshotWeight: overrides.snapshotWeight ?? 0.5,
    snapshotValue: overrides.snapshotValue ?? 5000,
    snapshotQuantity: overrides.snapshotQuantity ?? 50,
    snapshotPrice: overrides.snapshotPrice ?? 281.31,
    priceCurrency: overrides.priceCurrency ?? "USD",
    planTargetWeight: overrides.planTargetWeight ?? 0.6,
    returnAdjustedTarget: overrides.returnAdjustedTarget ?? 0.58,
    effectiveTarget: overrides.effectiveTarget ?? 0.6,
    hasOverride: overrides.hasOverride ?? false,
    deltaValue: overrides.deltaValue ?? 1000,
    deltaQuantity: overrides.deltaQuantity ?? 10,
    action: overrides.action ?? "BUY",
    excluded,
    locked: overrides.locked ?? false,
    sortOrder: overrides.sortOrder ?? 0,
    isCash: overrides.isCash ?? false,
    rationale: overrides.rationale ?? undefined,
    isExcluded: overrides.isExcluded ?? excluded,
    projectedValue: overrides.projectedValue ?? 6000,
    projectedWeight:
      overrides.projectedWeight === undefined
        ? 0.65
        : overrides.projectedWeight,
    ...overrides,
  } as DisplayItem
}

function makeExecution(overrides: Partial<ExecutionDto> = {}): ExecutionDto {
  return {
    id: "exec-1",
    planId: "plan-1",
    planVersion: 1,
    modelId: "model-1",
    modelName: "Test Model",
    portfolioIds: ["portfolio-1"],
    snapshotTotalValue: 10000,
    snapshotCashValue: 1000,
    totalPortfolioValue: 10000,
    currency: "USD",
    status: "DRAFT",
    mode: "REBALANCE",
    items: [],
    cashSummary: {
      currentCash: 1000,
      cashFromSales: 0,
      cashForPurchases: 0,
      netImpact: 0,
      projectedCash: 1000,
    },
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  } as ExecutionDto
}

function mockHookResult(
  displayItems: DisplayItem[],
  overrides: Partial<UseRebalanceExecutionResult> = {},
): void {
  const execution = makeExecution()
  mockUseRebalanceExecution.mockReturnValue({
    execution,
    displayItems,
    activeItems: displayItems.filter(
      (i) => !i.isExcluded && !i.isCash && Math.abs(i.deltaValue) > 100,
    ),
    cashSummary: {
      currentMarketValue: 10000,
      currentCash: 1000,
      targetCash: 1000,
      cashFromSales: 0,
      cashForPurchases: 0,
      netImpact: 0,
      projectedCash: 1000,
    },
    brokers: [],
    selectedBrokerId: undefined,
    setSelectedBrokerId: jest.fn(),
    states: {
      loading: false,
      saving: false,
      refreshing: false,
      committing: false,
      hasChanges: false,
      error: null,
    },
    handlers: {
      initialize: jest.fn(),
      save: jest.fn().mockResolvedValue(true),
      refresh: jest.fn(),
      commit: jest.fn(),
      targetChange: jest.fn(),
      excludeToggle: jest.fn(),
      setAllToCurrent: jest.fn(),
      setAllToTarget: jest.fn(),
      setAllToZero: jest.fn(),
      setAllToAdjusted: jest.fn(),
      setToCurrent: jest.fn(),
      setToTarget: jest.fn(),
      setError: jest.fn(),
    },
    createdExecutionId: null,
    ...overrides,
  } as UseRebalanceExecutionResult)
}

describe("ExecuteRebalancePage", () => {
  beforeEach(() => {
    mockUseRebalanceExecution.mockReset()
  })

  it("does not render an Adjusted column or an 'All -> Adjusted' bulk button", () => {
    mockHookResult([makeItem()])
    render(<ExecuteRebalancePage />)

    expect(screen.queryByText("Adjusted")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /All.*Adjusted/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByTitle(/return-adjusted/i)).not.toBeInTheDocument()
  })

  it("renders the price column as value + currency, and — when price is null", () => {
    mockHookResult([
      makeItem({ assetId: "a1", snapshotPrice: 281.31, priceCurrency: "USD" }),
      makeItem({
        assetId: "a2",
        assetCode: "MSFT",
        snapshotPrice: undefined,
        priceCurrency: undefined,
      }),
    ])
    render(<ExecuteRebalancePage />)

    expect(screen.getByText("281.31 USD")).toBeInTheDocument()
    expect(screen.getByText("—")).toBeInTheDocument()
  })

  it("tints a positive-delta-quantity row green and a negative one red; leaves excluded/zero rows neutral", () => {
    mockHookResult([
      makeItem({ assetId: "buy-asset", assetCode: "BUY1", deltaQuantity: 5 }),
      makeItem({
        assetId: "sell-asset",
        assetCode: "SELL1",
        deltaQuantity: -5,
      }),
      makeItem({
        assetId: "excluded-asset",
        assetCode: "EXCL1",
        deltaQuantity: 5,
        excluded: true,
        isExcluded: true,
      }),
      makeItem({
        assetId: "flat-asset",
        assetCode: "FLAT1",
        deltaQuantity: 0,
      }),
    ])
    render(<ExecuteRebalancePage />)

    const buyRow = screen.getByText("BUY1").closest("tr")
    const sellRow = screen.getByText("SELL1").closest("tr")
    const excludedRow = screen.getByText("EXCL1").closest("tr")
    const flatRow = screen.getByText("FLAT1").closest("tr")

    expect(buyRow?.className).toContain("bg-green-50")
    expect(sellRow?.className).toContain("bg-red-50")
    // Excluded takes precedence over a nonzero delta.
    expect(excludedRow?.className).not.toContain("bg-green-50")
    expect(excludedRow?.className).not.toContain("bg-red-50")
    expect(flatRow?.className).not.toContain("bg-green-50")
    expect(flatRow?.className).not.toContain("bg-red-50")
  })

  it("opens the price chart with the row's asset identifier when the chart affordance is clicked", () => {
    mockHookResult([makeItem({ assetId: "asset-xyz", assetCode: "XYZ" })])
    render(<ExecuteRebalancePage />)

    expect(screen.queryByTestId("price-chart-popup")).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle("Price history chart"))

    expect(screen.getByTestId("price-chart-popup")).toBeInTheDocument()
    expect(screen.getByTestId("chart-asset-id")).toHaveTextContent("asset-xyz")
    expect(screen.getByTestId("chart-asset-code")).toHaveTextContent("XYZ")
  })

  it("opens the AI insight popup seeded with a prompt containing the asset code and target %", () => {
    mockHookResult([
      makeItem({
        assetId: "asset-xyz",
        assetCode: "XYZ",
        effectiveTarget: 0.42,
      }),
    ])
    render(<ExecuteRebalancePage />)

    expect(screen.queryByTestId("asset-insight-popup")).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle("Ask AI about this asset"))

    expect(screen.getByTestId("asset-insight-popup")).toBeInTheDocument()
    const query = screen.getByTestId("insight-query").textContent || ""
    expect(query).toContain("XYZ")
    expect(query).toContain("42.00%")
    expect(query).toMatch(/DRAFT/)
  })
})
