import React from "react"
import { render, screen } from "@testing-library/react"
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

const makeAdhocExecution = (): ExecutionDto => ({
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
      assetId: "asset-1",
      assetCode: "AAPL",
      assetName: "Apple Inc",
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
      id: "cash-item",
      assetId: "cash-usd",
      assetCode: "USD",
      assetName: "US Dollar",
      snapshotWeight: 0.5,
      snapshotValue: 5000,
      snapshotQuantity: 5000,
      snapshotPrice: 1,
      priceCurrency: "USD",
      planTargetWeight: 0.5,
      effectiveTarget: 0.5,
      hasOverride: false,
      deltaValue: 0,
      deltaQuantity: 0,
      action: "HOLD",
      excluded: false,
      locked: false,
      sortOrder: 1,
      isCash: true,
    },
  ],
  cashSummary: {
    currentCash: 5000,
    cashFromSales: 0,
    cashForPurchases: 0,
    netImpact: 0,
    projectedCash: 5000,
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

describe("ExecuteRebalancePage — ad-hoc (no plan/model)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    routerState.query = { adhoc: "1", portfolios: "p1", currency: "USD" }
    executionState.execution = makeAdhocExecution()
  })

  it("shows 'Ad-hoc Rebalance' header and no plan/model line when modelName is null", () => {
    render(<ExecuteRebalancePage />)

    expect(
      screen.getByRole("heading", { name: "Ad-hoc Rebalance" }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Using plan/)).not.toBeInTheDocument()
  })

  it("does not throw when planVersion/modelId are null", () => {
    expect(() => render(<ExecuteRebalancePage />)).not.toThrow()
  })
})
