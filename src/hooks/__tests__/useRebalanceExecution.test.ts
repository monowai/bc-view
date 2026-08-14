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
  isPrivate: overrides.isPrivate,
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
  // Nullable AD_HOC fields: use `in` rather than `??` so an explicit `null`
  // override (ad-hoc fixtures) isn't collapsed back to the default — `??`
  // treats null and undefined alike.
  planId: "planId" in overrides ? overrides.planId! : "plan-1",
  planVersion: "planVersion" in overrides ? overrides.planVersion! : 1,
  modelId: "modelId" in overrides ? overrides.modelId! : "model-1",
  modelName: "modelName" in overrides ? overrides.modelName! : "Test Model",
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

  it("creates ad-hoc execution when adhoc+currency provided without planId", async () => {
    const exec = makeExecution({
      id: "adhoc-exec-1",
      planId: null,
      planVersion: null,
      modelId: null,
      modelName: null,
    })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: exec }),
    })

    const { result } = renderHook(() =>
      useRebalanceExecution({
        portfolioIds: ["portfolio-1"],
        adhoc: true,
        currency: "USD",
      }),
    )

    await act(async () => {})

    expect(global.fetch).toHaveBeenCalledWith("/api/rebalance/executions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "AD_HOC",
        portfolioIds: ["portfolio-1"],
        currency: "USD",
      }),
    })
    expect(result.current.execution).toEqual(exec)
    expect(result.current.createdExecutionId).toBe("adhoc-exec-1")
  })

  it("guards against a duplicate create POST when the mount effect fires twice before the first create resolves (React 18 dev double-invoke)", async () => {
    const exec = makeExecution({ id: "new-exec-1" })
    // Never resolves within this test — we only care how many creates were
    // dispatched before the (guarded) second attempt bails out.
    let resolveFetch: (value: unknown) => void = () => {}
    ;(global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )

    const { result } = renderHook(() =>
      useRebalanceExecution({
        planId: "plan-1",
        portfolioIds: ["portfolio-1"],
        filterByModel: true,
      }),
    )

    // The mount effect has already fired initializeExecution() once (fetch
    // #1 is in flight, paused before its `await` resolves). Simulate a
    // second invocation of the same effect body — exactly what React 18
    // StrictMode's dev double-invoke (or a re-render racing the in-flight
    // create) does — before any state from the first call has committed.
    act(() => {
      result.current.handlers.initialize()
    })

    const createCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url, opts]) =>
        url === "/api/rebalance/executions" && opts?.method === "POST",
    )
    expect(createCalls.length).toBe(1)

    // Let the in-flight create resolve so the test doesn't leak a pending
    // promise/timer into the next test.
    await act(async () => {
      resolveFetch({ ok: true, json: () => Promise.resolve({ data: exec }) })
      await Promise.resolve()
    })
  })

  it("does not create an execution when adhoc is true but currency is missing", async () => {
    const { result } = renderHook(() =>
      useRebalanceExecution({
        portfolioIds: ["portfolio-1"],
        adhoc: true,
      }),
    )

    await act(async () => {})

    expect(global.fetch).not.toHaveBeenCalledWith(
      "/api/rebalance/executions",
      expect.anything(),
    )
    expect(result.current.execution).toBeNull()
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

  it("handleSave preserves server-seeded excluded items the user never toggled", async () => {
    // Regression (E2E-confirmed, critical): on execution CREATE (ad-hoc or
    // model-based), the hook seeds localOverrides from the response but
    // never seeds localExclusions (unlike the load-existing-execution path,
    // which does). So a2 arrives excluded=true from the server (e.g. the
    // backend auto-excludes a PRIVATE/CPF asset) but localExclusions has no
    // entry for it. If handleSave falls back to `?? false` instead of `??
    // item.excluded`, it clobbers the server-seeded exclusion, and the
    // backend then recalculates and proposes a sell-to-zero for it.
    const exec = makeExecution({
      id: "adhoc-exec-1",
      planId: null,
      planVersion: null,
      modelId: null,
      modelName: null,
      items: [
        makeItem({ assetId: "a1", excluded: false }),
        makeItem({ assetId: "a2", excluded: true }),
        makeCashItem({ assetId: "cash" }),
      ],
    })
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: exec }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: exec }),
      })

    const { result } = renderHook(() =>
      useRebalanceExecution({
        portfolioIds: ["portfolio-1"],
        adhoc: true,
        currency: "USD",
      }),
    )

    await act(async () => {})
    expect(result.current.execution).toEqual(exec)

    // The user never touches a2's checkbox — only an unrelated target
    // change on a1.
    act(() => {
      result.current.handlers.targetChange("a1", 0.7)
    })

    await act(async () => {
      await result.current.handlers.save()
    })

    const putCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url, opts]) =>
        url === "/api/rebalance/executions/adhoc-exec-1" &&
        opts?.method === "PUT",
    )
    expect(putCall).toBeDefined()
    const body = JSON.parse(putCall![1].body)
    const a2Update = body.itemUpdates.find(
      (u: { assetId: string }) => u.assetId === "a2",
    )
    expect(a2Update.excluded).toBe(true)
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

    let commitResult:
      | { portfolioId: string; transactionStatus: "PROPOSED" | "SETTLED" }
      | undefined
    await act(async () => {
      commitResult = await result.current.handlers.commit()
    })

    expect(commitResult).toEqual({
      portfolioId: "portfolio-1",
      transactionStatus: "PROPOSED",
    })
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

  // --- Projected weight (After %) ---

  it("raising a small position's target funds it via deposit and dilutes the other rows' projected weight", async () => {
    // Portfolio: big position 1000 (25% of 4000), small position 200 (5% of
    // 4000), a third untouched holding making up the remaining 2800 (70%),
    // cash 0. Plan target weights mirror snapshot weights so untouched rows
    // have zero delta unless overridden.
    const exec = makeExecution({
      totalPortfolioValue: 4000,
      snapshotCashValue: 0,
      items: [
        makeItem({
          id: "big",
          assetId: "big-asset",
          assetCode: "GOOG",
          snapshotWeight: 0.25,
          snapshotValue: 1000,
          planTargetWeight: 0.25,
          snapshotPrice: 100,
        }),
        makeItem({
          id: "small",
          assetId: "small-asset",
          assetCode: "MSFT",
          snapshotWeight: 0.05,
          snapshotValue: 200,
          planTargetWeight: 0.05,
          snapshotPrice: 100,
        }),
        makeItem({
          id: "rest",
          assetId: "rest-asset",
          assetCode: "OTHER",
          snapshotWeight: 0.7,
          snapshotValue: 2800,
          planTargetWeight: 0.7,
          snapshotPrice: 100,
        }),
        makeCashItem({
          assetId: "cash",
          snapshotWeight: 0,
          snapshotValue: 0,
          planTargetWeight: 0,
        }),
      ],
    })

    const { result } = await renderWithExecution(exec)

    act(() => {
      // 5% -> 10%
      result.current.handlers.targetChange("small-asset", 0.1)
    })

    const small = result.current.displayItems.find(
      (i) => i.assetId === "small-asset",
    )
    const big = result.current.displayItems.find(
      (i) => i.assetId === "big-asset",
    )

    // Funded by a deposit (no sales elsewhere): delta ~= +200
    expect(small?.deltaValue).toBeCloseTo(200, 5)

    // Big position's own value is untouched, but the portfolio total grows
    // by the deposit (4000 -> 4200), so its projected weight drops.
    expect(big?.deltaValue).toBeCloseTo(0, 5)
    expect(big?.projectedWeight).toBeCloseTo(1000 / 4200, 4)

    // All (non-excluded) rows' projected weights sum to ~100%.
    const total = result.current.displayItems.reduce(
      (sum, item) => sum + (item.projectedWeight ?? 0),
      0,
    )
    expect(total).toBeCloseTo(1, 5)
  })

  it("landing with no overrides never yields a nonzero deltaQuantity from proportional-scaling float noise", async () => {
    // Three equal-weight holdings whose planTargetWeight mirrors current
    // weight (as an AD_HOC execution seeds it) sum to 0.8999999999999999 in
    // floating point rather than an exact 0.9 — the proportional-scaling
    // formula (planTargetWeight / totalPlanTargetWeights * availableForAssets)
    // then lands effectiveTarget a few 1e-15 pp off snapshotWeight even
    // though nothing was edited. deltaQuantity rounds that residual to a
    // whole share, which must resolve to 0 (not a phantom +/-1) so the
    // "Delta" column stays neutral on landing.
    const exec = makeExecution({
      totalPortfolioValue: 10000,
      snapshotCashValue: 1000,
      items: [
        makeItem({
          id: "a",
          assetId: "a-asset",
          assetCode: "AAA",
          snapshotWeight: 0.3,
          snapshotValue: 3000,
          planTargetWeight: 0.3,
          snapshotPrice: 100,
        }),
        makeItem({
          id: "b",
          assetId: "b-asset",
          assetCode: "BBB",
          snapshotWeight: 0.3,
          snapshotValue: 3000,
          planTargetWeight: 0.3,
          snapshotPrice: 100,
        }),
        makeItem({
          id: "c",
          assetId: "c-asset",
          assetCode: "CCC",
          snapshotWeight: 0.3,
          snapshotValue: 3000,
          planTargetWeight: 0.3,
          snapshotPrice: 100,
        }),
        makeCashItem({
          assetId: "cash",
          snapshotWeight: 0.1,
          snapshotValue: 1000,
          planTargetWeight: 0.1,
        }),
      ],
    })

    const { result } = await renderWithExecution(exec)

    for (const item of result.current.displayItems) {
      if (!item.isCash) {
        expect(item.deltaQuantity).toBe(0)
      }
    }
  })

  it("internal shuffle funded by an offsetting sale leaves projected total and untouched rows' weight unchanged", async () => {
    // Sell 300 from X, buy 300 into Y — self-funded, cash stays positive and
    // unchanged, so the projected total should equal the snapshot total and
    // the untouched row Z's projected weight should equal its current weight.
    const exec = makeExecution({
      totalPortfolioValue: 5000,
      snapshotCashValue: 1000,
      items: [
        makeItem({
          id: "x",
          assetId: "x-asset",
          assetCode: "X",
          snapshotWeight: 0.2,
          snapshotValue: 1000,
          planTargetWeight: 0.2,
          snapshotPrice: 100,
        }),
        makeItem({
          id: "y",
          assetId: "y-asset",
          assetCode: "Y",
          snapshotWeight: 0.2,
          snapshotValue: 1000,
          planTargetWeight: 0.2,
          snapshotPrice: 100,
        }),
        makeItem({
          id: "z",
          assetId: "z-asset",
          assetCode: "Z",
          snapshotWeight: 0.4,
          snapshotValue: 2000,
          planTargetWeight: 0.4,
          snapshotPrice: 100,
        }),
        makeCashItem({
          assetId: "cash",
          snapshotWeight: 0.2,
          snapshotValue: 1000,
          planTargetWeight: 0.2,
        }),
      ],
    })

    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.targetChange("x-asset", 0.14) // sell 300
      result.current.handlers.targetChange("y-asset", 0.26) // buy 300
    })

    const z = result.current.displayItems.find((i) => i.assetId === "z-asset")
    const cash = result.current.displayItems.find((i) => i.isCash)

    expect(result.current.cashSummary.projectedCash).toBeCloseTo(1000, 5)
    expect(cash?.projectedWeight).toBeCloseTo(1000 / 5000, 5)

    // Untouched row's projected weight is unchanged from its snapshot weight.
    expect(z?.projectedWeight).toBeCloseTo(z!.snapshotWeight, 5)

    const total = result.current.displayItems.reduce(
      (sum, item) => sum + (item.projectedWeight ?? 0),
      0,
    )
    expect(total).toBeCloseTo(1, 5)
  })

  it("excludes an excluded/PRIVATE row from the projected-total denominator and its own projected weight", async () => {
    const exec = makeExecution({
      totalPortfolioValue: 5000,
      snapshotCashValue: 1000,
      items: [
        makeItem({
          id: "priv",
          assetId: "private-asset",
          assetCode: "PRIV",
          snapshotWeight: 0,
          snapshotValue: 500,
          planTargetWeight: 0,
          snapshotPrice: 100,
          excluded: true,
        }),
        makeItem({
          id: "a1",
          assetId: "a1",
          assetCode: "A1",
          snapshotWeight: 0.6,
          snapshotValue: 3000,
          planTargetWeight: 0.6,
          snapshotPrice: 100,
        }),
        makeCashItem({
          assetId: "cash",
          snapshotWeight: 0.2,
          snapshotValue: 1000,
          planTargetWeight: 0.2,
        }),
      ],
    })

    const { result } = await renderWithExecution(exec)

    const priv = result.current.displayItems.find(
      (i) => i.assetId === "private-asset",
    )
    expect(priv?.projectedWeight).toBeNull()

    const total = result.current.displayItems.reduce(
      (sum, item) => sum + (item.projectedWeight ?? 0),
      0,
    )
    expect(total).toBeCloseTo(1, 5)
  })

  // --- Brokers ---

  it("derives brokers from SWR data", () => {
    const broker1 = { id: "b1", name: "IB" }
    const broker2 = { id: "b2", name: "Schwab" }

    mockUseSwr.mockImplementation((() => ({
      data: { data: [broker1, broker2] },
      isLoading: false,
      error: undefined,
    })) as unknown as typeof useSwr)

    const { result } = renderHook(() =>
      useRebalanceExecution({ portfolioIds: [] }),
    )

    expect(result.current.brokers).toEqual([broker1, broker2])
  })

  // --- Selection state ---

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

  // --- originalTarget seeding + per-row reset ---

  it("seeds originalTarget from the loaded execution's effectiveTarget, independent of hasOverride", async () => {
    const exec = makeExecution({
      items: [
        makeItem({
          assetId: "a1",
          hasOverride: true,
          effectiveTarget: 0.75,
        }),
        makeItem({ assetId: "a2", effectiveTarget: 0.4, hasOverride: false }),
        makeCashItem({ assetId: "cash" }),
      ],
    })

    const { result } = await renderWithExecution(exec)

    expect(
      result.current.displayItems.find((i) => i.assetId === "a1")
        ?.originalTarget,
    ).toBe(0.75)
    expect(
      result.current.displayItems.find((i) => i.assetId === "a2")
        ?.originalTarget,
    ).toBe(0.4)
  })

  it("seeds originalTarget from the return-adjusted target on a newly-created execution", async () => {
    const exec = makeExecution({
      id: "new-exec-1",
      items: [
        makeItem({
          assetId: "a1",
          returnAdjustedTarget: 0.55,
          effectiveTarget: 0.6,
        }),
        makeCashItem({ assetId: "cash" }),
      ],
    })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: exec }),
    })

    const { result } = renderHook(() =>
      useRebalanceExecution({
        planId: "plan-1",
        portfolioIds: ["portfolio-1"],
      }),
    )
    await act(async () => {})

    // Non-cash item seeded from returnAdjustedTarget (matches the applied
    // override); cash has none, so it falls back to its own effectiveTarget.
    expect(
      result.current.displayItems.find((i) => i.assetId === "a1")
        ?.originalTarget,
    ).toBe(0.55)
    expect(
      result.current.displayItems.find((i) => i.assetId === "cash")
        ?.originalTarget,
    ).toBe(exec.items.find((i) => i.assetId === "cash")!.effectiveTarget)
  })

  it("resetTarget restores a single row's target to its seeded original, undoing any later edits", async () => {
    const exec = makeExecution({
      items: [
        makeItem({ assetId: "a1", effectiveTarget: 0.5 }),
        makeCashItem({ assetId: "cash" }),
      ],
    })
    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.targetChange("a1", 0.9)
    })
    expect(
      result.current.displayItems.find((i) => i.assetId === "a1")
        ?.effectiveTarget,
    ).toBe(0.9)

    act(() => {
      result.current.handlers.resetTarget("a1")
    })
    expect(
      result.current.displayItems.find((i) => i.assetId === "a1")
        ?.effectiveTarget,
    ).toBe(0.5)
  })

  // --- setIncludeAll (select-all header checkbox) ---

  it("setIncludeAll(false) excludes every non-cash, non-locked row and leaves locked rows untouched", async () => {
    const exec = makeExecution({
      items: [
        makeItem({ assetId: "a1", excluded: false, locked: false }),
        makeItem({ assetId: "a2", excluded: false, locked: false }),
        makeItem({ assetId: "locked-1", excluded: false, locked: true }),
        makeCashItem({ assetId: "cash" }),
      ],
    })
    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.setIncludeAll(false)
    })

    const byId = (id: string): boolean | undefined =>
      result.current.displayItems.find((i) => i.assetId === id)?.isExcluded
    expect(byId("a1")).toBe(true)
    expect(byId("a2")).toBe(true)
    // Locked row's exclusion is never touched by the bulk action.
    expect(byId("locked-1")).toBe(false)
    // Cash isn't a toggleable row either.
    expect(byId("cash")).toBe(false)
  })

  it("setIncludeAll(true) re-includes previously-excluded eligible rows, still leaving locked rows alone", async () => {
    // a1/a2 start included at load (NOT server-excluded) and are excluded
    // locally by the user mid-session — this is what the test exercises:
    // a locally-excluded row is re-includable. A row that was ALREADY
    // excluded=true in the server payload at load is a different case (the
    // isPrivate-undefined fallback immunity — see the PRIVATE-row tests
    // below), so it's deliberately not used here.
    const exec = makeExecution({
      items: [
        makeItem({ assetId: "a1", excluded: false }),
        makeItem({ assetId: "a2", excluded: false }),
        makeItem({ assetId: "locked-1", excluded: true, locked: true }),
        makeCashItem({ assetId: "cash" }),
      ],
    })
    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.excludeToggle("a1")
      result.current.handlers.excludeToggle("a2")
    })

    act(() => {
      result.current.handlers.setIncludeAll(true)
    })

    const byId = (id: string): boolean | undefined =>
      result.current.displayItems.find((i) => i.assetId === id)?.isExcluded
    expect(byId("a1")).toBe(false)
    expect(byId("a2")).toBe(false)
    expect(byId("locked-1")).toBe(true)
  })

  // --- PRIVATE row immunity (isPrivate) ---

  it("setIncludeAll(true) never re-includes an isPrivate row, even from an indeterminate mixed state", async () => {
    // a1 carries an explicit isPrivate: false (a real, current-backend
    // response) so it's unambiguously a normal row, distinct from the
    // isPrivate-undefined fallback case covered separately below.
    const exec = makeExecution({
      items: [
        makeItem({ assetId: "a1", excluded: true, isPrivate: false }),
        makeItem({ assetId: "cpf-1", excluded: true, isPrivate: true }),
        makeCashItem({ assetId: "cash" }),
      ],
    })
    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.setIncludeAll(true)
    })

    const byId = (id: string): boolean | undefined =>
      result.current.displayItems.find((i) => i.assetId === id)?.isExcluded
    expect(byId("a1")).toBe(false)
    // The isPrivate row stays excluded regardless of direction.
    expect(byId("cpf-1")).toBe(true)
  })

  it("setIncludeAll(false) leaves an isPrivate row excluded (no-op, already excluded)", async () => {
    const exec = makeExecution({
      items: [
        makeItem({ assetId: "a1", excluded: false }),
        makeItem({ assetId: "cpf-1", excluded: true, isPrivate: true }),
        makeCashItem({ assetId: "cash" }),
      ],
    })
    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.setIncludeAll(false)
    })

    const byId = (id: string): boolean | undefined =>
      result.current.displayItems.find((i) => i.assetId === id)?.isExcluded
    expect(byId("a1")).toBe(true)
    expect(byId("cpf-1")).toBe(true)
  })

  it("excludeToggle is a no-op for an isPrivate row (belt-and-braces against a stray call)", async () => {
    const exec = makeExecution({
      items: [
        makeItem({ assetId: "cpf-1", excluded: true, isPrivate: true }),
        makeCashItem({ assetId: "cash" }),
      ],
    })
    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.excludeToggle("cpf-1")
    })

    const item = result.current.displayItems.find((i) => i.assetId === "cpf-1")
    expect(item?.isExcluded).toBe(true)
    expect(result.current.states.hasChanges).toBe(false)
  })

  it("fallback (no isPrivate field anywhere): setIncludeAll(true) leaves a row that arrived server-excluded at load untouched", async () => {
    // Old backend hasn't deployed isPrivate yet — every item has
    // isPrivate === undefined. The row that was excluded=true in the
    // server payload at load time must stay immune to the bulk toggle,
    // same as a real isPrivate row would be. a1 arrived included at load,
    // so it's a normal row under the same fallback — it toggles freely.
    const exec = makeExecution({
      items: [
        makeItem({ assetId: "a1", excluded: false }),
        makeItem({ assetId: "cpf-1", excluded: true }),
        makeCashItem({ assetId: "cash" }),
      ],
    })
    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.setIncludeAll(true)
    })

    const byId = (id: string): boolean | undefined =>
      result.current.displayItems.find((i) => i.assetId === id)?.isExcluded
    expect(byId("a1")).toBe(false)
    // Was server-excluded at load, isPrivate undefined -> immune fallback.
    expect(byId("cpf-1")).toBe(true)
  })

  it("fallback: a row that was NOT excluded at load (isPrivate undefined) is a normal toggleable row", async () => {
    const exec = makeExecution({
      items: [
        makeItem({ assetId: "a1", excluded: false }),
        makeItem({ assetId: "a2", excluded: false }),
        makeCashItem({ assetId: "cash" }),
      ],
    })
    const { result } = await renderWithExecution(exec)

    act(() => {
      result.current.handlers.setIncludeAll(false)
    })

    const byId = (id: string): boolean | undefined =>
      result.current.displayItems.find((i) => i.assetId === id)?.isExcluded
    expect(byId("a1")).toBe(true)
    expect(byId("a2")).toBe(true)
  })

  it("handleSave omits isPrivate rows from itemUpdates", async () => {
    const exec = makeExecution({
      items: [
        makeItem({ assetId: "a1", excluded: false }),
        makeItem({ assetId: "cpf-1", excluded: true, isPrivate: true }),
        makeCashItem({ assetId: "cash" }),
      ],
    })
    const { result } = await renderWithExecution(
      exec,
      {},
      { ok: true, data: { data: exec } },
    )

    act(() => {
      result.current.handlers.targetChange("a1", 0.7)
    })

    await act(async () => {
      await result.current.handlers.save()
    })

    const putCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url, opts]) =>
        url === "/api/rebalance/executions/exec-1" && opts?.method === "PUT",
    )
    expect(putCall).toBeDefined()
    const body = JSON.parse(putCall![1].body)
    const cpfUpdate = body.itemUpdates.find(
      (u: { assetId: string }) => u.assetId === "cpf-1",
    )
    expect(cpfUpdate).toBeUndefined()
    const a1Update = body.itemUpdates.find(
      (u: { assetId: string }) => u.assetId === "a1",
    )
    expect(a1Update).toBeDefined()
  })

  it("displayItems flags isImmune for an isPrivate row and for a fallback server-excluded-at-load row, but not for a normal row", async () => {
    const exec = makeExecution({
      items: [
        makeItem({ assetId: "a1", excluded: false }),
        makeItem({ assetId: "cpf-1", excluded: true, isPrivate: true }),
        makeItem({ assetId: "fallback-1", excluded: true }),
        makeCashItem({ assetId: "cash" }),
      ],
    })
    const { result } = await renderWithExecution(exec)

    const byId = (id: string): boolean | undefined =>
      result.current.displayItems.find((i) => i.assetId === id)?.isImmune
    expect(byId("a1")).toBe(false)
    expect(byId("cpf-1")).toBe(true)
    expect(byId("fallback-1")).toBe(true)
  })
})

// --- Characterization: mixed-currency client math ---
//
// `makeItem`/`makeExecution` already default `priceCurrency`/`currency` to
// "USD" but accept overrides, so no fixture-factory changes were needed for
// this block — see the top-level fixtures above.
describe("characterization: mixed-currency client math (#1154/#1156)", () => {
  // These tests document what the CURRENT client math in
  // useRebalanceExecution.ts actually produces when an execution's items
  // carry a `priceCurrency` that differs from the execution/portfolio's own
  // reporting currency. The hook's computed memo (useRebalanceExecution.ts
  // ~lines 642-788) never reads `priceCurrency` at all: `totalPortfolioValue`,
  // `snapshotValue`, `snapshotCashValue` and `snapshotPrice` are all treated
  // as plain numbers in one implicit unit. In particular `deltaQuantity`
  // (line ~699-703) divides a delta expressed in the execution's reporting
  // currency by `snapshotPrice`, which may be quoted in a different currency
  // entirely — silently mixing currencies to produce a share count. These
  // tests pin that behavior for future refactors; they do NOT bless it as
  // correct. The fix belongs on the backend (#1154) per the
  // backend-drives-data hard rule.

  it("a) an asset priced in USD inside an SGD-reporting execution: deltaValue/deltaQuantity mix the two currencies without conversion", async () => {
    const exec = makeExecution({
      currency: "SGD",
      totalPortfolioValue: 10000,
      snapshotCashValue: 1000,
      items: [
        makeItem({
          id: "usd-item",
          assetId: "usd-asset",
          assetCode: "AAPL",
          priceCurrency: "USD",
          snapshotWeight: 0.5,
          snapshotValue: 5000,
          snapshotPrice: 100,
          planTargetWeight: 0.6,
          isCash: false,
        }),
        makeCashItem({
          assetId: "cash",
          priceCurrency: "SGD",
          snapshotWeight: 0.1,
          snapshotValue: 1000,
          planTargetWeight: 0.1,
        }),
      ],
    })

    const { result } = await renderWithExecution(exec)

    const usdItem = result.current.displayItems.find(
      (i) => i.assetId === "usd-asset",
    )
    // No override, no other non-cash items: proportional scaling collapses
    // to (planTargetWeight / totalPlanTargetWeights) * availableForAssets
    // = (0.6 / 0.6) * (1 - 0.1) = 0.9.
    expect(usdItem?.effectiveTarget).toBeCloseTo(0.9, 10)
    // targetValue = 10000 (SGD) * 0.9 = 9000 (SGD); deltaValue = 9000 - 5000
    // (the item's own snapshotValue, also nominally SGD per the DTO) = 4000.
    expect(usdItem?.deltaValue).toBeCloseTo(4000, 6)
    // deltaQuantity = round(deltaValue / snapshotPrice) = round(4000 / 100)
    // = 40 -- a "4000 SGD" delta divided by a "100 USD" price, treated as
    // the same unit. priceCurrency is never consulted.
    expect(usdItem?.deltaQuantity).toBe(40)

    // Cash summary: the 4000 buy has to be funded from somewhere. Nothing
    // was sold, cashPositionChange is 0 (cash target == current), so the
    // hook reports a deposit requirement of exactly the mismatched delta.
    expect(result.current.cashSummary.cashForPurchases).toBeCloseTo(4000, 6)
    expect(result.current.cashSummary.cashFromSales).toBe(0)
    expect(result.current.cashSummary.netImpact).toBeCloseTo(-4000, 6)
    // projectedCash is unclamped and goes negative -- "needs a deposit".
    expect(result.current.cashSummary.projectedCash).toBeCloseTo(-3000, 6)

    // projectedWeight: excluded rows aside, projectedTotal only ever sums
    // snapshotValue + deltaValue across items -- again currency-blind. Cash
    // is clamped to 0 (can't fund the deposit from itself), so the USD item
    // ends up owning 100% of the projected total.
    expect(usdItem?.projectedWeight).toBeCloseTo(1, 6)
    const cash = result.current.displayItems.find((i) => i.isCash)
    expect(cash?.projectedValue).toBe(0)
    expect(cash?.projectedWeight).toBe(0)
  })

  it("b) a plan-only asset (no held position) quoted in EUR inside an SGD-reporting execution gets a full target allocation and a currency-blind share count", async () => {
    const exec = makeExecution({
      currency: "SGD",
      totalPortfolioValue: 10000,
      snapshotCashValue: 1000,
      items: [
        makeItem({
          id: "held",
          assetId: "held-asset",
          assetCode: "MSFT",
          priceCurrency: "USD",
          snapshotWeight: 0.9,
          snapshotValue: 9000,
          snapshotPrice: 100,
          planTargetWeight: 0.5,
          isCash: false,
        }),
        makeItem({
          id: "plan-only",
          assetId: "eur-planonly-asset",
          assetCode: "SAP",
          priceCurrency: "EUR",
          // Not currently held: zero snapshot position, but still carries a
          // plan target weight, exactly like a brand-new model addition.
          snapshotWeight: 0,
          snapshotValue: 0,
          snapshotQuantity: 0,
          snapshotPrice: 50,
          planTargetWeight: 0.5,
          isCash: false,
        }),
        makeCashItem({
          assetId: "cash",
          priceCurrency: "SGD",
          snapshotWeight: 0.1,
          snapshotValue: 1000,
          planTargetWeight: 0.1,
        }),
      ],
    })

    const { result } = await renderWithExecution(exec)

    const planOnly = result.current.displayItems.find(
      (i) => i.assetId === "eur-planonly-asset",
    )
    // totalPlanTargetWeights (non-cash) = 0.5 + 0.5 = 1.0; availableForAssets
    // = 0.9; effectiveTarget = (0.5 / 1.0) * 0.9 = 0.45 for both non-cash rows.
    expect(planOnly?.effectiveTarget).toBeCloseTo(0.45, 10)
    // targetValue = 10000 * 0.45 = 4500 (SGD); deltaValue = 4500 - 0 = 4500,
    // even though the asset has never been held and is quoted in EUR.
    expect(planOnly?.deltaValue).toBeCloseTo(4500, 6)
    // deltaQuantity = round(4500 / 50) = 90 "shares" -- again the SGD-valued
    // delta is divided by a EUR-quoted price with no FX applied.
    expect(planOnly?.deltaQuantity).toBe(90)

    const held = result.current.displayItems.find(
      (i) => i.assetId === "held-asset",
    )
    expect(held?.effectiveTarget).toBeCloseTo(0.45, 10)
    expect(held?.deltaValue).toBeCloseTo(-4500, 6)
    expect(held?.deltaQuantity).toBe(-45)

    // This scenario happens to be self-funding (sale of `held` == purchase
    // of `plan-only`), so cash is untouched and the projected weights land
    // exactly on the (currency-blind) target weights.
    expect(result.current.cashSummary.netImpact).toBeCloseTo(0, 6)
    expect(result.current.cashSummary.projectedCash).toBeCloseTo(1000, 6)
    expect(planOnly?.projectedWeight).toBeCloseTo(0.45, 6)
    expect(held?.projectedWeight).toBeCloseTo(0.45, 6)
  })

  it("c) two portfolios with different native currencies are flattened into one item list with no per-portfolio currency segregation", async () => {
    // ExecutionDto exposes a single aggregate `currency` field and
    // ExecutionItemDto carries no portfolioId -- the hook's surface has no
    // concept of "this item belongs to that portfolio's currency". This
    // test documents that: with portfolioIds.length === 2, the compute pass
    // still just sums raw item numbers regardless of each item's own
    // (notionally per-portfolio) priceCurrency.
    const exec = makeExecution({
      portfolioIds: ["portfolio-usd", "portfolio-sgd"],
      currency: "SGD",
      totalPortfolioValue: 20000,
      snapshotCashValue: 2000,
      items: [
        makeItem({
          id: "usd-port-item",
          assetId: "usd-port-asset",
          assetCode: "VOO",
          priceCurrency: "USD",
          snapshotWeight: 0.4,
          snapshotValue: 8000,
          snapshotPrice: 200,
          planTargetWeight: 0.45,
          isCash: false,
        }),
        makeItem({
          id: "sgd-port-item",
          assetId: "sgd-port-asset",
          assetCode: "ES3",
          priceCurrency: "SGD",
          snapshotWeight: 0.5,
          snapshotValue: 10000,
          snapshotPrice: 500,
          planTargetWeight: 0.45,
          isCash: false,
        }),
        makeCashItem({
          assetId: "cash",
          priceCurrency: "SGD",
          snapshotWeight: 0.1,
          snapshotValue: 2000,
          planTargetWeight: 0.1,
        }),
      ],
    })

    const { result } = await renderWithExecution(exec)
    expect(result.current.execution?.portfolioIds).toEqual([
      "portfolio-usd",
      "portfolio-sgd",
    ])

    const usdItem = result.current.displayItems.find(
      (i) => i.assetId === "usd-port-asset",
    )
    const sgdItem = result.current.displayItems.find(
      (i) => i.assetId === "sgd-port-asset",
    )

    // totalPlanTargetWeights = 0.45 + 0.45 = 0.9 = availableForAssets, so
    // effectiveTarget == planTargetWeight for both, unaffected by which
    // portfolio (or currency) each item nominally came from.
    expect(usdItem?.effectiveTarget).toBeCloseTo(0.45, 10)
    expect(sgdItem?.effectiveTarget).toBeCloseTo(0.45, 10)

    // targetValue = 20000 * 0.45 = 9000 for both.
    expect(usdItem?.deltaValue).toBeCloseTo(1000, 6) // 9000 - 8000
    expect(sgdItem?.deltaValue).toBeCloseTo(-1000, 6) // 9000 - 10000
    // deltaQuantity divides the aggregate-currency delta by each item's own
    // native price -- USD price for the "USD portfolio" item, SGD price for
    // the "SGD portfolio" item -- with no currency-aware boundary between
    // the two portfolios' contributions to the flattened items array.
    expect(usdItem?.deltaQuantity).toBe(5) // round(1000 / 200)
    expect(sgdItem?.deltaQuantity).toBe(-2) // round(-1000 / 500)

    // Self-funding across the two portfolios' items: cash is untouched.
    expect(result.current.cashSummary.cashFromSales).toBeCloseTo(1000, 6)
    expect(result.current.cashSummary.cashForPurchases).toBeCloseTo(1000, 6)
    expect(result.current.cashSummary.netImpact).toBeCloseTo(0, 6)

    const total = result.current.displayItems.reduce(
      (sum, item) => sum + (item.projectedWeight ?? 0),
      0,
    )
    expect(total).toBeCloseTo(1, 5)
  })
})
