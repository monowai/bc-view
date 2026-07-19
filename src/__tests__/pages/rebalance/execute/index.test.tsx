import React from "react"
import { render, screen, fireEvent, within, act } from "@testing-library/react"
import ExecuteRebalancePage, {
  buildDraftContext,
} from "@pages/rebalance/execute/index"
import { useRebalanceExecution } from "@hooks/useRebalanceExecution"
import type {
  DisplayItem,
  UseRebalanceExecutionResult,
} from "@hooks/useRebalanceExecution"
import type { ExecutionDto } from "types/rebalance"
import { setPageContext } from "@components/features/chat/pageContextBus"

jest.mock("@components/features/chat/pageContextBus", () => ({
  setPageContext: jest.fn(),
}))
const mockSetPageContext = setPageContext as jest.Mock

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
    // Defaults to effectiveTarget (i.e. "no edit yet") unless a test is
    // specifically exercising a row that's diverged from its seeded value.
    originalTarget:
      overrides.originalTarget ?? overrides.effectiveTarget ?? 0.6,
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
    isPrivate: overrides.isPrivate,
    isImmune: overrides.isImmune ?? false,
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

/** Default jest.fn()s for every hook handler — a test that wants to assert
 * a specific call passes `overrides.handlers` with just that one key; it's
 * deep-merged over these defaults below rather than replacing the whole
 * handlers map (which would silently null out the rest). */
function makeDefaultHandlers(): UseRebalanceExecutionResult["handlers"] {
  return {
    initialize: jest.fn(),
    save: jest.fn().mockResolvedValue(true),
    refresh: jest.fn(),
    commit: jest.fn(),
    targetChange: jest.fn(),
    excludeToggle: jest.fn(),
    setIncludeAll: jest.fn(),
    setAllToCurrent: jest.fn(),
    setAllToTarget: jest.fn(),
    setAllToZero: jest.fn(),
    setAllToAdjusted: jest.fn(),
    setToCurrent: jest.fn(),
    setToTarget: jest.fn(),
    resetTarget: jest.fn(),
    setError: jest.fn(),
  }
}

function mockHookResult(
  displayItems: DisplayItem[],
  overrides: Partial<Omit<UseRebalanceExecutionResult, "handlers">> & {
    handlers?: Partial<UseRebalanceExecutionResult["handlers"]>
  } = {},
): UseRebalanceExecutionResult {
  const execution = makeExecution()
  const result = {
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
    createdExecutionId: null,
    ...overrides,
    handlers: { ...makeDefaultHandlers(), ...overrides.handlers },
  } as UseRebalanceExecutionResult
  mockUseRebalanceExecution.mockReturnValue(result)
  return result
}

describe("ExecuteRebalancePage", () => {
  beforeEach(() => {
    mockUseRebalanceExecution.mockReset()
    mockSetPageContext.mockReset()
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

  it("renders the configuration table columns with Target adjacent to After %, trade breakdown split into its own Trade column", () => {
    mockHookResult([makeItem()])
    render(<ExecuteRebalancePage />)

    // Only the configuration table is rendered while step === "configure".
    const table = screen.getByRole("table")
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((th) => th.textContent?.trim())

    expect(headers).toEqual([
      "",
      "Asset",
      "Price",
      "Current",
      "Target",
      "After %",
      "Trade",
    ])
  })

  it("CASH row's delta cell mirrors cashSummary.netImpact exactly — not the row's own (stale) deltaValue", () => {
    mockHookResult(
      [
        makeItem({
          assetId: "cash",
          assetCode: "CASH",
          isCash: true,
          deltaValue: 1, // deliberately stale/irrelevant — must NOT be displayed
        }),
      ],
      {
        cashSummary: {
          currentMarketValue: 10000,
          currentCash: 1000,
          targetCash: 1000,
          cashFromSales: 2000,
          cashForPurchases: 1500,
          netImpact: 500,
          projectedCash: 1500,
        },
      },
    )
    render(<ExecuteRebalancePage />)

    const cashRow = screen.getByText("CASH").closest("tr")
    expect(cashRow).not.toBeNull()
    expect(within(cashRow!).getByText("+500.00")).toBeInTheDocument()
    expect(within(cashRow!).getByText("+500.00")).toHaveClass("text-green-700")
    expect(within(cashRow!).queryByText("+1.00")).not.toBeInTheDocument()
  })

  it("CASH row's delta cell shows netImpact in red when negative, and a Deposit sub-line when projected cash is negative", () => {
    mockHookResult(
      [
        makeItem({
          assetId: "cash",
          assetCode: "CASH",
          isCash: true,
          deltaValue: 1,
          projectedWeight: 0,
        }),
      ],
      {
        cashSummary: {
          currentMarketValue: 10000,
          currentCash: 1000,
          targetCash: 1000,
          cashFromSales: 0,
          cashForPurchases: 11472.49,
          netImpact: -10472.49,
          projectedCash: -9472.49,
        },
      },
    )
    render(<ExecuteRebalancePage />)

    const cashRow = screen.getByText("CASH").closest("tr")
    expect(cashRow).not.toBeNull()
    expect(within(cashRow!).getByText("-10,472.49")).toBeInTheDocument()
    expect(within(cashRow!).getByText("-10,472.49")).toHaveClass("text-red-700")
    expect(within(cashRow!).getByText(/Deposit/)).toBeInTheDocument()
    expect(within(cashRow!).getByText(/9,472\.49/)).toBeInTheDocument()
  })

  it("ad-hoc mode hides the 'All -> Target' bulk button and shows a single 'Reset' button", () => {
    mockHookResult([makeItem()], {
      execution: makeExecution({ mode: "AD_HOC", modelName: null }),
    })
    render(<ExecuteRebalancePage />)

    expect(
      screen.queryByRole("button", { name: /All.*Target/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /All.*0/i })).toBeInTheDocument()
  })

  it("plan/model mode keeps the full bulk-button set (All -> Current, All -> Target, All -> 0)", () => {
    mockHookResult([makeItem()])
    render(<ExecuteRebalancePage />)

    expect(
      screen.getByRole("button", { name: /All.*Current/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /All.*Target/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /All.*0/i })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Reset" }),
    ).not.toBeInTheDocument()
  })

  // --- Select-all checkbox (Change 1) ---

  describe("select-all include checkbox", () => {
    it("is checked, not indeterminate, when every eligible row is included", () => {
      mockHookResult([
        makeItem({ assetId: "a1", isExcluded: false }),
        makeItem({ assetId: "a2", isExcluded: false }),
      ])
      render(<ExecuteRebalancePage />)

      const checkbox = screen.getByLabelText("Include all") as HTMLInputElement
      expect(checkbox.checked).toBe(true)
      expect(checkbox.indeterminate).toBe(false)
    })

    it("is unchecked, not indeterminate, when every eligible row is excluded", () => {
      mockHookResult([
        makeItem({ assetId: "a1", isExcluded: true, excluded: true }),
        makeItem({ assetId: "a2", isExcluded: true, excluded: true }),
      ])
      render(<ExecuteRebalancePage />)

      const checkbox = screen.getByLabelText("Include all") as HTMLInputElement
      expect(checkbox.checked).toBe(false)
      expect(checkbox.indeterminate).toBe(false)
    })

    it("is indeterminate when some eligible rows are included and some excluded", () => {
      mockHookResult([
        makeItem({ assetId: "a1", isExcluded: false }),
        makeItem({ assetId: "a2", isExcluded: true, excluded: true }),
      ])
      render(<ExecuteRebalancePage />)

      const checkbox = screen.getByLabelText("Include all") as HTMLInputElement
      expect(checkbox.checked).toBe(false)
      expect(checkbox.indeterminate).toBe(true)
    })

    it("ignores locked (PRIVATE/server-locked) rows entirely — they never drive checked/indeterminate", () => {
      mockHookResult([
        makeItem({ assetId: "a1", isExcluded: false }),
        makeItem({
          assetId: "locked-1",
          assetCode: "PRIV",
          locked: true,
          isExcluded: true,
          excluded: true,
        }),
      ])
      render(<ExecuteRebalancePage />)

      // Only "a1" is eligible and it's included -> checked, despite the
      // locked row being excluded.
      const checkbox = screen.getByLabelText("Include all") as HTMLInputElement
      expect(checkbox.checked).toBe(true)
      expect(checkbox.indeterminate).toBe(false)
    })

    it("clicking calls handlers.setIncludeAll with the opposite of the current checked state, and never toggles a locked row's own checkbox", () => {
      const setIncludeAll = jest.fn()
      mockHookResult(
        [
          makeItem({ assetId: "a1", assetCode: "AAPL", isExcluded: false }),
          makeItem({
            assetId: "locked-1",
            assetCode: "PRIV",
            locked: true,
            isExcluded: true,
            excluded: true,
          }),
        ],
        { handlers: { setIncludeAll } },
      )
      render(<ExecuteRebalancePage />)

      fireEvent.click(screen.getByLabelText("Include all"))
      // All eligible rows are currently included (only a1 counts) -> click
      // flips to "exclude all".
      expect(setIncludeAll).toHaveBeenCalledWith(false)

      // The locked row's own row-level checkbox is disabled — never wired to
      // excludeToggle by a stray click.
      const lockedCheckbox = screen.getByTitle(
        "Locked — not eligible for execution",
      ) as HTMLInputElement
      expect(lockedCheckbox).toBeDisabled()
    })

    it("ignores isPrivate rows entirely — they never drive checked/indeterminate", () => {
      mockHookResult([
        makeItem({ assetId: "a1", isExcluded: false }),
        makeItem({
          assetId: "cpf-1",
          assetCode: "CPF",
          isPrivate: true,
          isImmune: true,
          isExcluded: true,
          excluded: true,
        }),
      ])
      render(<ExecuteRebalancePage />)

      // Only "a1" is eligible and it's included -> checked, despite the
      // PRIVATE row being excluded.
      const checkbox = screen.getByLabelText("Include all") as HTMLInputElement
      expect(checkbox.checked).toBe(true)
      expect(checkbox.indeterminate).toBe(false)
    })

    it("clicking never toggles an isPrivate row's own checkbox — it's disabled with a non-tradeable title/aria-label", () => {
      const setIncludeAll = jest.fn()
      mockHookResult(
        [
          makeItem({ assetId: "a1", assetCode: "AAPL", isExcluded: false }),
          makeItem({
            assetId: "cpf-1",
            assetCode: "CPF",
            isPrivate: true,
            isImmune: true,
            isExcluded: true,
            excluded: true,
          }),
        ],
        { handlers: { setIncludeAll } },
      )
      render(<ExecuteRebalancePage />)

      fireEvent.click(screen.getByLabelText("Include all"))
      // Only a1 is eligible and currently included -> click flips to
      // "exclude all"; the isPrivate row plays no part in that decision.
      expect(setIncludeAll).toHaveBeenCalledWith(false)

      const privateCheckbox = screen.getByLabelText(
        "Non-tradeable asset — always excluded",
      ) as HTMLInputElement
      expect(privateCheckbox).toBeDisabled()
      expect(privateCheckbox.checked).toBe(true)
      expect(privateCheckbox.title).toBe(
        "Non-tradeable asset — always excluded",
      )
    })
  })

  // --- Per-row reset (Change 3) ---

  describe("per-row reset to original", () => {
    it("is disabled when the target still matches the original seeded weight", () => {
      mockHookResult([
        makeItem({
          assetId: "a1",
          assetCode: "AAPL",
          effectiveTarget: 0.6,
          originalTarget: 0.6,
        }),
      ])
      render(<ExecuteRebalancePage />)

      expect(screen.getByLabelText("Reset AAPL weight")).toBeDisabled()
    })

    it("is enabled when the target has diverged from the original, and clicking resets it", () => {
      const resetTarget = jest.fn()
      mockHookResult(
        [
          makeItem({
            assetId: "a1",
            assetCode: "AAPL",
            effectiveTarget: 0.6,
            originalTarget: 0.5,
          }),
        ],
        { handlers: { resetTarget } },
      )
      render(<ExecuteRebalancePage />)

      const resetButton = screen.getByLabelText("Reset AAPL weight")
      expect(resetButton).toBeEnabled()

      fireEvent.click(resetButton)
      expect(resetTarget).toHaveBeenCalledWith("a1")
    })
  })

  // --- Slider re-anchoring (Change 4) ---

  describe("slider re-anchoring", () => {
    /** A live-updating hook mock: `targetChange` actually mutates the
     * backing items array (closed over), so a subsequent re-render (however
     * triggered) picks up the new `effectiveTarget` — needed to observe the
     * slider's min/max/value react to a committed edit, not just a mocked
     * call. */
    function renderLive(initialItems: DisplayItem[]): {
      handlers: UseRebalanceExecutionResult["handlers"]
    } {
      let items = initialItems
      // Computed ONCE — the page's `useEffect(() => setSliderAnchors({}),
      // [execution])` treats a new `execution` reference as "full data
      // reload, drop all anchors". A fresh object per render (the mistake
      // this comment is guarding against) makes that effect fire on every
      // render and infinite-loop the test.
      const stableExecution = makeExecution()
      // Assigned after the initial render — `targetChange` re-renders through
      // it so the controlled slider/input's DOM value stays in sync with the
      // mutated `items`, same as production (where `targetChange` calls a
      // real `setState` that re-renders before the next native event fires).
      // Without this, React's controlled-input reconciliation reverts the
      // DOM's `value` back to the stale prop once the event handler returns,
      // since no state changed and no re-render occurred.
      let doRerender: (() => void) | null = null
      const handlers: UseRebalanceExecutionResult["handlers"] = {
        ...makeDefaultHandlers(),
        targetChange: jest.fn((assetId: string, value: number) => {
          items = items.map((i) =>
            i.assetId === assetId ? { ...i, effectiveTarget: value } : i,
          )
          doRerender?.()
        }),
      }
      mockUseRebalanceExecution.mockImplementation(
        () =>
          ({
            execution: stableExecution,
            displayItems: items,
            activeItems: [],
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
            createdExecutionId: null,
            handlers,
          }) as UseRebalanceExecutionResult,
      )
      const { rerender } = render(<ExecuteRebalancePage />)
      doRerender = () => rerender(<ExecuteRebalancePage />)
      return { handlers }
    }

    it("numeric-input commit re-anchors immediately: 20% -> 5% gives range [0,15], value 5", () => {
      renderLive([
        makeItem({
          assetId: "a1",
          assetCode: "AAPL",
          snapshotWeight: 0.2,
          effectiveTarget: 0.2,
          originalTarget: 0.2,
        }),
      ])

      fireEvent.change(screen.getByLabelText("AAPL target weight percent"), {
        target: { value: "5" },
      })

      const slider = screen.getByLabelText(
        "AAPL target weight",
      ) as HTMLInputElement
      expect(Number(slider.min)).toBe(0)
      expect(Number(slider.max)).toBe(15)
      expect(Number(slider.value)).toBe(5)
    })

    it("typed 25% anchors at 25 with range [15,35] — no more edge-pinning", () => {
      renderLive([
        makeItem({
          assetId: "a1",
          assetCode: "AAPL",
          snapshotWeight: 0.2,
          effectiveTarget: 0.2,
          originalTarget: 0.2,
        }),
      ])

      fireEvent.change(screen.getByLabelText("AAPL target weight percent"), {
        target: { value: "25" },
      })

      const slider = screen.getByLabelText(
        "AAPL target weight",
      ) as HTMLInputElement
      expect(Number(slider.min)).toBe(15)
      expect(Number(slider.max)).toBe(35)
      expect(Number(slider.value)).toBe(25)
    })

    it("holds the anchor fixed during an active drag, then re-anchors on pointer-up", () => {
      renderLive([
        makeItem({
          assetId: "a1",
          assetCode: "AAPL",
          snapshotWeight: 0.2,
          effectiveTarget: 0.2,
          originalTarget: 0.2,
        }),
      ])
      const slider = screen.getByLabelText(
        "AAPL target weight",
      ) as HTMLInputElement

      fireEvent.pointerDown(slider)
      // 25 lands exactly on the default 5-point slider step grid, so
      // snapToStep is a no-op here — keeps the assertion arithmetic simple.
      fireEvent.change(slider, { target: { value: "25" } })
      // Still mid-drag — range must not have shifted off the pre-drag anchor (20).
      expect(Number(slider.min)).toBe(10)
      expect(Number(slider.max)).toBe(30)

      fireEvent.pointerUp(slider)
      // Gesture complete — next render anchors on the committed value (25).
      expect(Number(slider.min)).toBe(15)
      expect(Number(slider.max)).toBe(35)
      expect(Number(slider.value)).toBe(25)
    })

    it("debounces keyboard/arrow-driven changes, re-anchoring ~400ms after the last one", () => {
      jest.useFakeTimers()
      try {
        renderLive([
          makeItem({
            assetId: "a1",
            assetCode: "AAPL",
            snapshotWeight: 0.2,
            effectiveTarget: 0.2,
            originalTarget: 0.2,
          }),
        ])
        const slider = screen.getByLabelText(
          "AAPL target weight",
        ) as HTMLInputElement

        // No pointerdown -> keyboard path. Range must not jump immediately.
        fireEvent.change(slider, { target: { value: "25" } })
        expect(Number(slider.min)).toBe(10)
        expect(Number(slider.max)).toBe(30)

        act(() => {
          jest.advanceTimersByTime(400)
        })

        expect(Number(slider.min)).toBe(15)
        expect(Number(slider.max)).toBe(35)
      } finally {
        jest.useRealTimers()
      }
    })
  })

  // --- Delta-vs-original label (Change 4) ---

  it("Trade column's pp delta label shows change vs the ORIGINAL seeded weight, not vs current", () => {
    mockHookResult([
      makeItem({
        assetId: "a1",
        assetCode: "AAPL",
        snapshotWeight: 0.25,
        originalTarget: 0.2,
        effectiveTarget: 0.3,
        deltaQuantity: 5,
        deltaValue: 500,
      }),
    ])
    render(<ExecuteRebalancePage />)

    const row = screen.getByText("AAPL").closest("tr")!
    // vs original (20% -> 30%) = +10.0, NOT vs current (25% -> 30%) = +5.0.
    // Default slider step is 5, so the label renders at 1 fraction digit.
    expect(within(row).getByText("+10.0")).toBeInTheDocument()
    expect(within(row).queryByText("+5.0")).not.toBeInTheDocument()
  })

  // --- Live draft context published to the Chat FAB (Change 5) ---

  describe("draft context published to the Chat FAB", () => {
    it("publishes a summary mentioning changed rows and cash summary, and clears it on unmount", () => {
      mockHookResult([
        makeItem({
          assetId: "a1",
          assetCode: "AAPL",
          snapshotWeight: 0.2,
          originalTarget: 0.2,
          effectiveTarget: 0.3,
        }),
      ])
      const { unmount } = render(<ExecuteRebalancePage />)

      const lastCall =
        mockSetPageContext.mock.calls[mockSetPageContext.mock.calls.length - 1]
      expect(lastCall[0]).toContain("DRAFT")
      expect(lastCall[0]).toContain("AAPL")

      unmount()
      const finalCall =
        mockSetPageContext.mock.calls[mockSetPageContext.mock.calls.length - 1]
      expect(finalCall[0]).toBeNull()
    })
  })
})

// --- buildDraftContext (pure serializer) ---

describe("buildDraftContext", () => {
  it("lists only changed rows, counts unchanged rows, and frames the summary as a draft", () => {
    const execution = makeExecution({ id: "exec-9", mode: "REBALANCE" })
    const items: DisplayItem[] = [
      makeItem({
        assetId: "changed-1",
        assetCode: "AAPL",
        snapshotWeight: 0.2,
        originalTarget: 0.2,
        effectiveTarget: 0.3,
        projectedWeight: 0.28,
        deltaQuantity: 12,
        deltaValue: 1200,
      }),
      makeItem({
        assetId: "unchanged-1",
        assetCode: "MSFT",
        snapshotWeight: 0.4,
        originalTarget: 0.4,
        effectiveTarget: 0.4,
      }),
      makeItem({
        assetId: "excluded-1",
        assetCode: "TSLA",
        snapshotWeight: 0.1,
        originalTarget: 0.1,
        effectiveTarget: 0.1,
        excluded: true,
        isExcluded: true,
      }),
    ]
    const cashSummary = {
      currentMarketValue: 10000,
      currentCash: 1000,
      targetCash: 900,
      cashFromSales: 0,
      cashForPurchases: 1200,
      netImpact: -1200,
      projectedCash: -200,
    }

    const text = buildDraftContext(execution, items, cashSummary)

    expect(text).toMatch(/DRAFT/)
    expect(text).toContain("exec-9")
    expect(text).toContain("AAPL")
    expect(text).toContain("30.00%")
    expect(text).not.toContain("MSFT")
    expect(text).toContain("TSLA")
    expect(text).toContain("excluded")
    expect(text).toContain("Unchanged rows: 1")
    expect(text).toContain("-1,200.00")
    expect(text).toContain("DEPOSIT REQUIRED")
  })

  it("reports zero changed rows plainly when nothing has been edited", () => {
    const execution = makeExecution()
    const items: DisplayItem[] = [
      makeItem({
        assetId: "a1",
        snapshotWeight: 0.5,
        originalTarget: 0.5,
        effectiveTarget: 0.5,
      }),
    ]
    const cashSummary = {
      currentMarketValue: 10000,
      currentCash: 1000,
      targetCash: 1000,
      cashFromSales: 0,
      cashForPurchases: 0,
      netImpact: 0,
      projectedCash: 1000,
    }

    const text = buildDraftContext(execution, items, cashSummary)

    expect(text).toContain("Changed rows (0)")
    expect(text).not.toContain("DEPOSIT REQUIRED")
  })
})
