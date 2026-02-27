import { renderHook, act } from "@testing-library/react"
import { useRebalanceExecution } from "../useRebalanceExecution"
import useSwr from "swr"
import { ExecutionDto, ExecutionItemDto } from "types/rebalance"

jest.mock("swr")
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

// --- Fixtures ---

const makeItem = (
  overrides: Partial<ExecutionItemDto> = {},
): ExecutionItemDto => ({
  id: overrides.id ?? "item-1",
  assetId: overrides.assetId ?? "asset-1",
  assetCode: overrides.assetCode ?? "AAPL",
  assetName: overrides.assetName ?? "Apple Inc",
  snapshotWeight: overrides.snapshotWeight ?? 0.5,
  snapshotValue: overrides.snapshotValue ?? 5000,
  snapshotQuantity: overrides.snapshotQuantity ?? 50,
  snapshotPrice: overrides.snapshotPrice ?? 100,
  priceCurrency: overrides.priceCurrency ?? "USD",
  planTargetWeight: overrides.planTargetWeight ?? 0.6,
  returnAdjustedTarget: overrides.returnAdjustedTarget ?? 0.58,
  effectiveTarget: overrides.effectiveTarget ?? 0.6,
  hasOverride: overrides.hasOverride ?? false,
  deltaValue: overrides.deltaValue ?? 1000,
  deltaQuantity: overrides.deltaQuantity ?? 10,
  action: overrides.action ?? "BUY",
  excluded: overrides.excluded ?? false,
  locked: overrides.locked ?? false,
  sortOrder: overrides.sortOrder ?? 0,
  isCash: overrides.isCash ?? false,
  rationale: overrides.rationale ?? undefined,
})

const makeCashItem = (
  overrides: Partial<ExecutionItemDto> = {},
): ExecutionItemDto =>
  makeItem({
    id: "cash-item",
    assetId: "cash-usd",
    assetCode: "USD",
    assetName: "US Dollar",
    snapshotWeight: 0.1,
    snapshotValue: 1000,
    snapshotQuantity: 1000,
    snapshotPrice: 1,
    planTargetWeight: 0.1,
    returnAdjustedTarget: undefined,
    effectiveTarget: 0.1,
    isCash: true,
    action: "HOLD",
    deltaValue: 0,
    deltaQuantity: 0,
    ...overrides,
  })

const makeExecution = (
  overrides: Partial<ExecutionDto> = {},
): ExecutionDto => ({
  id: overrides.id ?? "exec-1",
  planId: overrides.planId ?? "plan-1",
  planVersion: overrides.planVersion ?? 1,
  modelId: overrides.modelId ?? "model-1",
  modelName: overrides.modelName ?? "Test Model",
  portfolioIds: overrides.portfolioIds ?? ["portfolio-1"],
  snapshotTotalValue: overrides.snapshotTotalValue ?? 10000,
  snapshotCashValue: overrides.snapshotCashValue ?? 1000,
  totalPortfolioValue: overrides.totalPortfolioValue ?? 10000,
  currency: overrides.currency ?? "USD",
  status: overrides.status ?? "DRAFT",
  mode: overrides.mode ?? "REBALANCE",
  items: overrides.items ?? [
    makeItem(),
    makeItem({
      id: "item-2",
      assetId: "asset-2",
      assetCode: "MSFT",
      assetName: "Microsoft",
      snapshotWeight: 0.4,
      snapshotValue: 4000,
      planTargetWeight: 0.3,
      returnAdjustedTarget: 0.32,
    }),
    makeCashItem(),
  ],
  cashSummary: overrides.cashSummary ?? {
    currentCash: 1000,
    cashFromSales: 0,
    cashForPurchases: 0,
    netImpact: 0,
    projectedCash: 1000,
    projectedMarketValue: 10000,
  },
  createdAt: overrides.createdAt ?? "2025-01-01",
  updatedAt: overrides.updatedAt ?? "2025-01-01",
})

/** Standard SWR mock: accounts + brokers */
function setupSwrMocks(
  accounts: Record<string, unknown> = {},
  brokers: unknown[] = [],
): void {
  mockUseSwr.mockImplementation(((key: string) => {
    if (key === "/api/assets?category=ACCOUNT") {
      return {
        data: { data: accounts },
        isLoading: false,
        error: undefined,
      }
    }
    // brokers
    return {
      data: { data: brokers },
      isLoading: false,
      error: undefined,
    }
  }) as typeof useSwr)
}

/** Mock fetch to return an execution, with optional extra responses queued after */
function mockFetchWithExecution(
  exec: ExecutionDto,
  ...extraResponses: Array<{ ok: boolean; status?: number; data?: unknown }>
): void {
  const mock = global.fetch as jest.Mock
  // First call loads the execution
  mock.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ data: exec }),
  })
  // Queue extra responses for save/refresh/commit
  for (const resp of extraResponses) {
    mock.mockResolvedValueOnce({
      ok: resp.ok,
      status: resp.status ?? (resp.ok ? 200 : 500),
      json: () => Promise.resolve(resp.data ?? {}),
    })
  }
}

/** Render the hook with an executionId and wait for initialization to complete */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function renderWithExecution(
  exec: ExecutionDto,
  paramOverrides: Record<string, unknown> = {},
  ...extraFetchResponses: Array<{
    ok: boolean
    status?: number
    data?: unknown
  }>
) {
  mockFetchWithExecution(exec, ...extraFetchResponses)

  const params = {
    executionId: exec.id,
    portfolioIds: exec.portfolioIds,
    ...paramOverrides,
  }

  const hook = renderHook(() => useRebalanceExecution(params))

  // Wait for useEffect init to complete
  await act(async () => {})

  return hook
}

describe("useRebalanceExecution", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
    global.fetch = jest.fn()
    setupSwrMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // --- Initial state ---

  it("returns initial empty state when no params provided", () => {
    const { result } = renderHook(() =>
      useRebalanceExecution({ portfolioIds: [] }),
    )

    expect(result.current.execution).toBeNull()
    expect(result.current.displayItems).toEqual([])
    expect(result.current.activeItems).toEqual([])
    expect(result.current.states.loading).toBe(false)
    expect(result.current.states.error).toBeNull()
    expect(result.current.createdExecutionId).toBeNull()
  })

  // --- Load existing execution ---

  it("loads existing execution by executionId", async () => {
    const exec = makeExecution()
    const { result } = await renderWithExecution(exec)

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/rebalance/executions/exec-1",
    )
    expect(result.current.execution).toEqual(exec)
    expect(result.current.states.loading).toBe(false)
  })

  it("sets error on failed load", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    const { result } = renderHook(() =>
      useRebalanceExecution({
        executionId: "exec-1",
        portfolioIds: ["portfolio-1"],
      }),
    )

    await act(async () => {})

    expect(result.current.states.error).toBe("Failed to load execution: 404")
    expect(result.current.execution).toBeNull()
  })

  // --- Create new execution ---

  it("creates new execution when planId provided without executionId", async () => {
    const exec = makeExecution({ id: "new-exec-1" })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: exec }),
    })

    const { result } = renderHook(() =>
      useRebalanceExecution({
        planId: "plan-1",
        portfolioIds: ["portfolio-1"],
        filterByModel: true,
      }),
    )

    await act(async () => {})

    expect(global.fetch).toHaveBeenCalledWith("/api/rebalance/executions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: "plan-1",
        portfolioIds: ["portfolio-1"],
        filterByModel: true,
      }),
    })
    expect(result.current.execution).toEqual(exec)
    expect(result.current.createdExecutionId).toBe("new-exec-1")
  })

  // --- Display items computation ---

  it("computes displayItems with effective targets", async () => {
    const exec = makeExecution({
      totalPortfolioValue: 10000,
      items: [
        makeItem({
          assetId: "a1",
          snapshotWeight: 0.5,
          snapshotValue: 5000,
          planTargetWeight: 0.6,
          snapshotPrice: 100,
          isCash: false,
        }),
        makeCashItem({
          assetId: "cash",
          snapshotWeight: 0.1,
          snapshotValue: 1000,
        }),
      ],
    })

    const { result } = await renderWithExecution(exec)

    expect(result.current.displayItems.length).toBe(2)

    // Cash item uses snapshotWeight as default
    const cashDisplay = result.current.displayItems.find((i) => i.isCash)
    expect(cashDisplay?.effectiveTarget).toBe(0.1)
  })

  it("filters activeItems to non-excluded, non-cash with significant delta", async () => {
    const exec = makeExecution({
      totalPortfolioValue: 10000,
      items: [
        makeItem({
          assetId: "buy-asset",
          snapshotWeight: 0.3,
          snapshotValue: 3000,
          planTargetWeight: 0.5,
          snapshotPrice: 100,
        }),
        makeItem({
          assetId: "hold-asset",
          snapshotWeight: 0.5,
          snapshotValue: 5000,
          planTargetWeight: 0.5,
          snapshotPrice: 100,
        }),
        makeCashItem({
          assetId: "cash",
          snapshotWeight: 0.2,
          snapshotValue: 2000,
        }),
      ],
    })

    const { result } = await renderWithExecution(exec)

    for (const item of result.current.activeItems) {
      expect(item.isCash).toBe(false)
      expect(item.isExcluded).toBe(false)
      expect(Math.abs(item.deltaValue)).toBeGreaterThan(100)
    }
  })

  // --- Target change handlers ---

  it("handleTargetChange updates local overrides and marks changes", async () => {
    const exec = makeExecution()
    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.targetChange("asset-1", 0.75)
    })

    expect(result.current.states.hasChanges).toBe(true)
    const item = result.current.displayItems.find(
      (i) => i.assetId === "asset-1",
    )
    expect(item?.effectiveTarget).toBe(0.75)
  })

  it("handleExcludeToggle toggles exclusion", async () => {
    const exec = makeExecution()
    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.excludeToggle("asset-1")
    })

    const item = result.current.displayItems.find(
      (i) => i.assetId === "asset-1",
    )
    expect(item?.isExcluded).toBe(true)
    expect(result.current.states.hasChanges).toBe(true)
  })

  it("handleSetAllToTarget clears overrides and exclusions", async () => {
    const exec = makeExecution()
    const { result } = await renderWithExecution(exec)

    // Set some overrides first
    act(() => {
      result.current.handlers.targetChange("asset-1", 0.9)
      result.current.handlers.excludeToggle("asset-2")
    })

    // Then reset all to target
    act(() => {
      result.current.handlers.setAllToTarget()
    })

    const item1 = result.current.displayItems.find(
      (i) => i.assetId === "asset-1",
    )
    const item2 = result.current.displayItems.find(
      (i) => i.assetId === "asset-2",
    )
    expect(item1?.isExcluded).toBe(false)
    expect(item2?.isExcluded).toBe(false)
  })

  it("handleSetAllToCurrent sets non-cash items to snapshot weights", async () => {
    const exec = makeExecution()
    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.setAllToCurrent()
    })

    for (const item of result.current.displayItems) {
      if (!item.isCash) {
        expect(item.effectiveTarget).toBe(item.snapshotWeight)
      }
    }
  })

  it("handleSetAllToZero sets non-cash to 0 and cash to 1", async () => {
    const exec = makeExecution()
    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.setAllToZero()
    })

    for (const item of result.current.displayItems) {
      if (item.isCash) {
        expect(item.effectiveTarget).toBe(1)
      } else {
        expect(item.effectiveTarget).toBe(0)
      }
    }
  })

  it("handleSetAllToAdjusted uses returnAdjustedTarget", async () => {
    const exec = makeExecution({
      items: [
        makeItem({
          assetId: "a1",
          returnAdjustedTarget: 0.55,
          planTargetWeight: 0.6,
          snapshotWeight: 0.5,
          snapshotValue: 5000,
        }),
        makeCashItem({ assetId: "cash" }),
      ],
      totalPortfolioValue: 10000,
    })

    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.setAllToAdjusted()
    })

    const item = result.current.displayItems.find((i) => i.assetId === "a1")
    expect(item?.effectiveTarget).toBe(0.55)
  })

  it("handleSetToCurrent copies snapshot weight for single item", async () => {
    const exec = makeExecution()
    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.setToCurrent("asset-1", 0.42)
    })

    const item = result.current.displayItems.find(
      (i) => i.assetId === "asset-1",
    )
    expect(item?.effectiveTarget).toBe(0.42)
  })

  it("handleSetToTarget removes override for single item", async () => {
    const exec = makeExecution()
    const { result } = await renderWithExecution(exec)

    // Set an override first
    act(() => {
      result.current.handlers.targetChange("asset-1", 0.99)
    })

    expect(
      result.current.displayItems.find((i) => i.assetId === "asset-1")
        ?.effectiveTarget,
    ).toBe(0.99)

    // Remove override
    act(() => {
      result.current.handlers.setToTarget("asset-1")
    })

    const item = result.current.displayItems.find(
      (i) => i.assetId === "asset-1",
    )
    expect(item?.effectiveTarget).not.toBe(0.99)
  })

  // --- Save ---

  it("handleSave sends PUT with item updates", async () => {
    const exec = makeExecution()
    const { result } = await renderWithExecution(
      exec,
      {},
      {
        ok: true,
        data: { data: exec },
      },
    )

    act(() => {
      result.current.handlers.targetChange("asset-1", 0.7)
    })

    await act(async () => {
      await result.current.handlers.save()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/rebalance/executions/exec-1",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      }),
    )
    expect(result.current.states.hasChanges).toBe(false)
  })

  // --- Refresh ---

  it("handleRefresh sends POST to refresh endpoint", async () => {
    const exec = makeExecution()
    const { result } = await renderWithExecution(
      exec,
      {},
      {
        ok: true,
        data: { data: exec },
      },
    )

    await act(async () => {
      await result.current.handlers.refresh()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/rebalance/executions/exec-1/refresh",
      { method: "POST" },
    )
  })

  // --- Commit ---

  it("handleCommit sends POST and returns portfolioId", async () => {
    const exec = makeExecution()
    const { result } = await renderWithExecution(
      exec,
      {},
      {
        ok: true,
        data: {
          data: {
            transactionsCreated: 3,
            transactionIds: ["t1", "t2", "t3"],
          },
        },
      },
    )

    let commitResult: { portfolioId: string } | undefined
    await act(async () => {
      commitResult = await result.current.handlers.commit()
    })

    expect(commitResult).toEqual({ portfolioId: "portfolio-1" })
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/rebalance/executions/exec-1/commit",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    )
  })

  it("handleCommit returns undefined on failure", async () => {
    const exec = makeExecution()
    const { result } = await renderWithExecution(
      exec,
      {},
      {
        ok: false,
        status: 500,
        data: { message: "Server error" },
      },
    )

    let commitResult: { portfolioId: string } | undefined
    await act(async () => {
      commitResult = await result.current.handlers.commit()
    })

    expect(commitResult).toBeUndefined()
    expect(result.current.states.error).toBe("Server error")
  })

  // --- Cash summary ---

  it("computes cash summary from display items", async () => {
    const exec = makeExecution({
      totalPortfolioValue: 10000,
      snapshotCashValue: 1000,
      items: [
        makeItem({
          assetId: "buy-asset",
          snapshotWeight: 0.3,
          snapshotValue: 3000,
          planTargetWeight: 0.5,
          snapshotPrice: 100,
        }),
        makeItem({
          assetId: "sell-asset",
          snapshotWeight: 0.5,
          snapshotValue: 5000,
          planTargetWeight: 0.3,
          snapshotPrice: 100,
        }),
        makeCashItem({
          assetId: "cash",
          snapshotWeight: 0.2,
          snapshotValue: 2000,
        }),
      ],
    })

    const { result } = await renderWithExecution(exec)

    expect(result.current.cashSummary.currentMarketValue).toBe(10000)
    expect(result.current.cashSummary.currentCash).toBe(1000)
  })

  // --- Settlement accounts and brokers ---

  it("derives settlement accounts from SWR data", () => {
    const acct1 = { id: "a1", name: "Account 1", code: "ACC1" }
    const acct2 = { id: "a2", name: "Account 2", code: "ACC2" }

    mockUseSwr.mockImplementation(((key: string) => {
      if (key === "/api/assets?category=ACCOUNT") {
        return {
          data: { data: { a1: acct1, a2: acct2 } },
          isLoading: false,
          error: undefined,
        }
      }
      return { data: { data: [] }, isLoading: false, error: undefined }
    }) as typeof useSwr)

    const { result } = renderHook(() =>
      useRebalanceExecution({ portfolioIds: [] }),
    )

    expect(result.current.settlementAccounts).toEqual([acct1, acct2])
  })

  it("derives brokers from SWR data", () => {
    const broker1 = { id: "b1", name: "IB" }
    const broker2 = { id: "b2", name: "Schwab" }

    mockUseSwr.mockImplementation(((key: string) => {
      if (key === "/api/assets?category=ACCOUNT") {
        return { data: { data: {} }, isLoading: false, error: undefined }
      }
      return {
        data: { data: [broker1, broker2] },
        isLoading: false,
        error: undefined,
      }
    }) as typeof useSwr)

    const { result } = renderHook(() =>
      useRebalanceExecution({ portfolioIds: [] }),
    )

    expect(result.current.brokers).toEqual([broker1, broker2])
  })

  // --- Selection state ---

  it("manages selectedSettlementAccount state", () => {
    const { result } = renderHook(() =>
      useRebalanceExecution({ portfolioIds: [] }),
    )

    expect(result.current.selectedSettlementAccount).toBeUndefined()

    act(() => {
      result.current.setSelectedSettlementAccount("acct-1")
    })

    expect(result.current.selectedSettlementAccount).toBe("acct-1")
  })

  it("manages selectedBrokerId state", () => {
    const { result } = renderHook(() =>
      useRebalanceExecution({ portfolioIds: [] }),
    )

    expect(result.current.selectedBrokerId).toBeUndefined()

    act(() => {
      result.current.setSelectedBrokerId("broker-1")
    })

    expect(result.current.selectedBrokerId).toBe("broker-1")
  })

  // --- Error handling ---

  it("setError updates error state", () => {
    const { result } = renderHook(() =>
      useRebalanceExecution({ portfolioIds: [] }),
    )

    act(() => {
      result.current.handlers.setError("Something went wrong")
    })

    expect(result.current.states.error).toBe("Something went wrong")

    act(() => {
      result.current.handlers.setError(null)
    })

    expect(result.current.states.error).toBeNull()
  })

  // --- Load with overrides from server ---

  it("initializes local overrides from existing execution items", async () => {
    const exec = makeExecution({
      items: [
        makeItem({
          assetId: "a1",
          hasOverride: true,
          effectiveTarget: 0.75,
          snapshotWeight: 0.5,
          snapshotValue: 5000,
          planTargetWeight: 0.6,
          snapshotPrice: 100,
        }),
        makeItem({
          assetId: "a2",
          excluded: true,
          snapshotWeight: 0.4,
          snapshotValue: 4000,
          planTargetWeight: 0.3,
          snapshotPrice: 50,
        }),
        makeCashItem({ assetId: "cash" }),
      ],
    })

    const { result } = await renderWithExecution(exec)

    // a1 has override => effectiveTarget should be 0.75
    const item1 = result.current.displayItems.find((i) => i.assetId === "a1")
    expect(item1?.effectiveTarget).toBe(0.75)

    // a2 is excluded
    const item2 = result.current.displayItems.find((i) => i.assetId === "a2")
    expect(item2?.isExcluded).toBe(true)
  })
})
