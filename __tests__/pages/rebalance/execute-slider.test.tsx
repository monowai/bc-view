import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { ExecutionDto } from "types/rebalance"

const routerState: {
  isReady: boolean
  query: Record<string, string>
  push: jest.Mock
  replace: jest.Mock
  back: jest.Mock
} = {
  isReady: true,
  query: { adhoc: "1", portfolios: "p1", currency: "USD" },
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
}
jest.mock("next/router", () => ({
  useRouter: () => ({ ...routerState }),
}))

const makeExecution = (): ExecutionDto => ({
  id: "adhoc-exec-1",
  planId: null,
  planVersion: null,
  modelId: null,
  modelName: null,
  portfolioIds: ["p1"],
  snapshotTotalValue: 10000,
  snapshotCashValue: 1000,
  totalPortfolioValue: 10000,
  currency: "USD",
  status: "DRAFT",
  mode: "AD_HOC",
  items: [
    {
      id: "item-1",
      assetId: "asset-qual",
      assetCode: "QUAL",
      assetName: "Quality ETF",
      snapshotWeight: 0.5,
      snapshotValue: 5000,
      snapshotQuantity: 50,
      snapshotPrice: 100,
      priceCurrency: "USD",
      planTargetWeight: 0.5,
      effectiveTarget: 0.5,
      hasOverride: false,
      deltaValue: 0,
      deltaQuantity: 0,
      action: "HOLD",
      excluded: false,
      locked: false,
      sortOrder: 0,
      isCash: false,
    },
    {
      id: "item-2",
      assetId: "asset-excluded",
      assetCode: "EXCL",
      assetName: "Excluded Co",
      snapshotWeight: 0.2,
      snapshotValue: 2000,
      snapshotQuantity: 20,
      snapshotPrice: 100,
      priceCurrency: "USD",
      planTargetWeight: 0.2,
      effectiveTarget: 0.2,
      hasOverride: false,
      deltaValue: 0,
      deltaQuantity: 0,
      action: "HOLD",
      excluded: true,
      locked: false,
      sortOrder: 1,
      isCash: false,
    },
  ],
  cashSummary: {
    currentCash: 3000,
    cashFromSales: 0,
    cashForPurchases: 0,
    netImpact: 0,
    projectedCash: 3000,
    projectedMarketValue: 10000,
  },
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
})

const executionState: {
  execution: ExecutionDto | null
  displayItems: unknown[]
  activeItems: unknown[]
  cashSummary: {
    currentMarketValue: number
    currentCash: number
    targetCash: number
    cashFromSales: number
    cashForPurchases: number
    netImpact: number
    projectedCash: number
  }
  brokers: unknown[]
  selectedBrokerId: string | undefined
  setSelectedBrokerId: jest.Mock
  states: {
    loading: boolean
    saving: boolean
    refreshing: boolean
    committing: boolean
    hasChanges: boolean
    error: string | null
  }
  handlers: Record<string, jest.Mock>
  createdExecutionId: string | null
} = {
  execution: null,
  displayItems: [],
  activeItems: [],
  cashSummary: {
    currentMarketValue: 0,
    currentCash: 0,
    targetCash: 0,
    cashFromSales: 0,
    cashForPurchases: 0,
    netImpact: 0,
    projectedCash: 0,
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
    save: jest.fn(),
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
}
jest.mock("@hooks/useRebalanceExecution", () => ({
  useRebalanceExecution: () => executionState,
}))

import ExecuteRebalancePage from "@pages/rebalance/execute"

// Build displayItems the way useRebalanceExecution would (adds isExcluded/isCash
// and the projected After-% fields). Non-cash rows here have zero delta, so
// projectedValue == snapshotValue and the total is just the portfolio value.
function displayItemsFor(execution: ExecutionDto): unknown[] {
  const total = execution.totalPortfolioValue
  return execution.items.map((item) => {
    const isCash = item.isCash ?? false
    const projectedValue = isCash
      ? execution.snapshotCashValue
      : item.snapshotValue + item.deltaValue
    return {
      ...item,
      effectiveTarget: item.effectiveTarget,
      deltaValue: item.deltaValue,
      deltaQuantity: item.deltaQuantity,
      isExcluded: item.excluded,
      isCash,
      projectedValue,
      projectedWeight: item.excluded ? null : projectedValue / total,
    }
  })
}

describe("ExecuteRebalancePage — slider weight editing", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    routerState.query = { adhoc: "1", portfolios: "p1", currency: "USD" }
    const execution = makeExecution()
    executionState.execution = execution
    executionState.displayItems = displayItemsFor(execution)
    executionState.activeItems = executionState.displayItems
    executionState.cashSummary = {
      currentMarketValue: 0,
      currentCash: 0,
      targetCash: 0,
      cashFromSales: 0,
      cashForPurchases: 0,
      netImpact: 0,
      projectedCash: 0,
    }
  })

  it("renders the step toggle defaulting to 5% and sliders at 5% step", () => {
    render(<ExecuteRebalancePage />)

    const fiveButton = screen.getByRole("button", { name: "5%" })
    expect(fiveButton).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "1%" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(screen.getByRole("button", { name: "0.01%" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )

    const slider = screen.getByRole("slider", { name: "QUAL target weight" })
    expect(slider).toHaveAttribute("step", "5")
  })

  it("switching the step toggle updates the slider step attr and numeric input step attr", () => {
    render(<ExecuteRebalancePage />)

    fireEvent.click(screen.getByRole("button", { name: "0.01%" }))

    expect(screen.getByRole("button", { name: "0.01%" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByRole("button", { name: "5%" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )

    const slider = screen.getByRole("slider", { name: "QUAL target weight" })
    expect(slider).toHaveAttribute("step", "0.01")

    const numeric = screen.getByRole("spinbutton", {
      name: "QUAL target weight percent",
    })
    expect(numeric).toHaveAttribute("step", "0.01")
  })

  it("dragging a row's slider to 15 with 5% step calls targetChange with 0.15", () => {
    render(<ExecuteRebalancePage />)

    const slider = screen.getByRole("slider", { name: "QUAL target weight" })
    fireEvent.change(slider, { target: { value: "15" } })

    expect(executionState.handlers.targetChange).toHaveBeenCalledWith(
      "asset-qual",
      0.15,
    )
  })

  it("snaps an off-step slider value to the nearest step before calling targetChange", () => {
    render(<ExecuteRebalancePage />)

    const slider = screen.getByRole("slider", { name: "QUAL target weight" })
    fireEvent.change(slider, { target: { value: "17" } })

    // 17 snapped to nearest multiple of 5 => 15 => 0.15
    expect(executionState.handlers.targetChange).toHaveBeenCalledWith(
      "asset-qual",
      0.15,
    )
  })

  it("disables the slider on an excluded row, mirroring the numeric input", () => {
    render(<ExecuteRebalancePage />)

    const slider = screen.getByRole("slider", { name: "EXCL target weight" })
    const numeric = screen.getByRole("spinbutton", {
      name: "EXCL target weight percent",
    })
    expect(slider).toBeDisabled()
    expect(numeric).toBeDisabled()
  })

  it("keeps the numeric input free to accept arbitrary 0.01 precision regardless of step toggle", () => {
    render(<ExecuteRebalancePage />)

    fireEvent.click(screen.getByRole("button", { name: "5%" }))

    const numeric = screen.getByRole("spinbutton", {
      name: "QUAL target weight percent",
    })
    fireEvent.change(numeric, { target: { value: "12.34" } })

    expect(executionState.handlers.targetChange).toHaveBeenCalledWith(
      "asset-qual",
      0.1234,
    )
  })

  // --- After % column ---

  it("renders the After % column with projected weights, dash for excluded rows, and a 100% total", () => {
    const execution: ExecutionDto = {
      ...makeExecution(),
      totalPortfolioValue: 10000,
      snapshotCashValue: 3000,
      items: [
        {
          id: "item-1",
          assetId: "asset-qual",
          assetCode: "QUAL",
          assetName: "Quality ETF",
          snapshotWeight: 0.5,
          snapshotValue: 5000,
          snapshotQuantity: 50,
          snapshotPrice: 100,
          priceCurrency: "USD",
          planTargetWeight: 0.5,
          effectiveTarget: 0.52,
          hasOverride: true,
          deltaValue: 200,
          deltaQuantity: 2,
          action: "BUY",
          excluded: false,
          locked: false,
          sortOrder: 0,
          isCash: false,
        },
        {
          id: "item-2",
          assetId: "asset-excluded",
          assetCode: "EXCL",
          assetName: "Excluded Co",
          snapshotWeight: 0.2,
          snapshotValue: 2000,
          snapshotQuantity: 20,
          snapshotPrice: 100,
          priceCurrency: "USD",
          planTargetWeight: 0.2,
          effectiveTarget: 0.2,
          hasOverride: false,
          deltaValue: 0,
          deltaQuantity: 0,
          action: "HOLD",
          excluded: true,
          locked: false,
          sortOrder: 1,
          isCash: false,
        },
        {
          id: "item-cash",
          assetId: "cash-usd",
          assetCode: "USD",
          assetName: "US Dollar",
          snapshotWeight: 0.3,
          snapshotValue: 3000,
          snapshotQuantity: 3000,
          snapshotPrice: 1,
          priceCurrency: "USD",
          planTargetWeight: 0.3,
          effectiveTarget: 0.3,
          hasOverride: false,
          deltaValue: 0,
          deltaQuantity: 0,
          action: "HOLD",
          excluded: false,
          locked: false,
          sortOrder: 2,
          isCash: true,
        },
      ],
    }
    executionState.execution = execution
    executionState.displayItems = displayItemsFor(execution)
    executionState.activeItems = executionState.displayItems

    const { container } = render(<ExecuteRebalancePage />)

    const headerCells = Array.from(container.querySelectorAll("thead th"))
    const afterIdx = headerCells.findIndex(
      (th) => th.textContent?.trim() === "After %",
    )
    expect(afterIdx).toBeGreaterThan(-1)

    const bodyRows = Array.from(container.querySelectorAll("tbody tr"))
    const afterValues = bodyRows.map((row) =>
      row.children[afterIdx]?.textContent?.trim(),
    )
    // QUAL: 5200/10000, EXCL: excluded -> dash, cash: 3000/10000
    expect(afterValues).toEqual(["52.00%", "—", "30.00%"])

    const footerRow = container.querySelector("tfoot tr")!
    expect(footerRow.children[afterIdx]?.textContent?.trim()).toBe("82.00%")
  })

  it("shows the funded-by-deposit footnote when projected cash is negative", () => {
    executionState.cashSummary.projectedCash = -500

    render(<ExecuteRebalancePage />)

    expect(
      screen.getByText(/Assumes required cash is funded/i),
    ).toBeInTheDocument()
  })

  it("hides the funded-by-deposit footnote when projected cash is non-negative", () => {
    executionState.cashSummary.projectedCash = 100

    render(<ExecuteRebalancePage />)

    expect(
      screen.queryByText(/Assumes required cash is funded/i),
    ).not.toBeInTheDocument()
  })
})
