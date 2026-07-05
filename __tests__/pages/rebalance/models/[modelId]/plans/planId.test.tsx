import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Controllable router mock — mimics Next.js Pages Router behaviour where, on
// client-side navigation, router.query is empty until router.isReady flips true.
const routerState: {
  isReady: boolean
  query: Record<string, string>
  push: jest.Mock
} = {
  isReady: false,
  query: {},
  push: jest.fn(),
}
jest.mock("next/router", () => ({
  useRouter: () => routerState,
}))

// Mock SWR so it behaves like the real thing: a null key means "don't fetch"
// (no data, not loading); a real key resolves to the matching fixture.
import useSwr from "swr"
jest.mock("swr")
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

const model = {
  id: "model-1",
  name: "Aggressive Growth",
  baseCurrency: "USD",
}

const plan = {
  id: "plan-1",
  modelId: "model-1",
  modelName: "Aggressive Growth",
  version: 1,
  status: "APPROVED",
  cashWeight: 0,
  createdAt: "2026-01-01T00:00:00Z",
  approvedAt: "2026-01-02T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
  assets: [
    {
      id: "pa-1",
      assetId: "asset-voo",
      assetCode: "NASDAQ:VOO",
      assetName: "Vanguard S&P 500 ETF",
      weight: 0.6,
      sortOrder: 0,
    },
    {
      id: "pa-2",
      assetId: "asset-qqq",
      assetCode: "NASDAQ:QQQ",
      assetName: "Invesco QQQ Trust",
      weight: 0.4,
      sortOrder: 1,
    },
  ],
}

const idle = {
  data: undefined,
  error: undefined,
  isLoading: false,
  isValidating: false,
  mutate: jest.fn(),
}

function swrByKey(key: unknown): ReturnType<typeof useSwr> {
  // Real SWR: null key => disabled (no data, not loading).
  if (!key) return idle as unknown as ReturnType<typeof useSwr>
  const k = String(key)
  if (k.endsWith("/plans/plan-1")) {
    return { ...idle, data: { data: plan } } as unknown as ReturnType<
      typeof useSwr
    >
  }
  if (k.endsWith("/models/model-1")) {
    return { ...idle, data: { data: model } } as unknown as ReturnType<
      typeof useSwr
    >
  }
  if (k.endsWith("/plans")) {
    return { ...idle, data: { data: [plan] } } as unknown as ReturnType<
      typeof useSwr
    >
  }
  return idle as unknown as ReturnType<typeof useSwr>
}

describe("/rebalance/models/[modelId]/plans/[planId] — Target Allocations", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
    mockUseSwr.mockImplementation((key: unknown) => swrByKey(key))
    routerState.isReady = false
    routerState.query = {}
  })

  test("does not flash 'Failed to load' before the router is ready", async () => {
    const { default: PlanDetailPage } =
      await import("../../../../../../src/pages/rebalance/models/[modelId]/plans/[planId]")

    // First client-side render: router not ready, query empty.
    render(<PlanDetailPage />)

    // Regression guard: while the route params are unknown we must show a
    // loading state, never the empty/error state that latches an empty page.
    expect(screen.queryByText(/Failed to load/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Vanguard S&P 500 ETF/i)).not.toBeInTheDocument()
  })

  test("renders allocations once the router becomes ready (no manual refresh)", async () => {
    const { default: PlanDetailPage } =
      await import("../../../../../../src/pages/rebalance/models/[modelId]/plans/[planId]")

    const { rerender } = render(<PlanDetailPage />)

    // Router resolves the dynamic params on a later tick (client-side nav).
    routerState.isReady = true
    routerState.query = { modelId: "model-1", planId: "plan-1" }
    rerender(<PlanDetailPage />)

    expect(await screen.findByText("Target Allocations")).toBeInTheDocument()
    expect(screen.getByText("Vanguard S&P 500 ETF")).toBeInTheDocument()
    expect(screen.getByText("Invesco QQQ Trust")).toBeInTheDocument()
  })

  test("renders allocations on mount when SWR already has warm cache (revisit nav)", async () => {
    const { default: PlanDetailPage } =
      await import("../../../../../../src/pages/rebalance/models/[modelId]/plans/[planId]")

    // Router is ready and SWR resolves data on the very first render — mirrors
    // a client-side revisit where the plan key is already cached, so `plan`
    // is non-undefined from the first render pass.
    routerState.isReady = true
    routerState.query = { modelId: "model-1", planId: "plan-1" }
    render(<PlanDetailPage />)

    expect(await screen.findByText("Target Allocations")).toBeInTheDocument()
    expect(screen.getByText("Vanguard S&P 500 ETF")).toBeInTheDocument()
    expect(screen.getByText("Invesco QQQ Trust")).toBeInTheDocument()
    expect(screen.queryByText(/No assets added yet/i)).not.toBeInTheDocument()
  })
})

describe("/rebalance/models/[modelId]/plans/[planId] — Copy allocations", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
    mockUseSwr.mockImplementation((key: unknown) => swrByKey(key))
    routerState.isReady = true
    routerState.query = { modelId: "model-1", planId: "plan-1" }
    window.localStorage.clear()
  })

  const openCopyDialog = async (
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> => {
    await user.click(
      screen.getByRole("button", { name: "Copy target allocations" }),
    )
  }
  const submitCopyDialog = async (
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> => {
    await user.click(screen.getByRole("button", { name: "Copy" }))
  }

  // userEvent.setup() installs its own navigator.clipboard stub, clobbering
  // any mock assigned beforehand — spy on the stub's writeText afterwards.
  const setupWithClipboardSpy = (): {
    user: ReturnType<typeof userEvent.setup>
    writeText: jest.SpyInstance
  } => {
    const user = userEvent.setup()
    const writeText = jest
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined)
    return { user, writeText }
  }

  test("prompts for fields, defaults narrative off, and remembers the choice", async () => {
    const { user, writeText } = setupWithClipboardSpy()
    const { default: PlanDetailPage } =
      await import("../../../../../../src/pages/rebalance/models/[modelId]/plans/[planId]")

    render(<PlanDetailPage />)
    await screen.findByText("Target Allocations")

    await openCopyDialog(user)

    expect(screen.getByLabelText("Weight %")).toBeChecked()
    expect(screen.getByLabelText("Price")).toBeChecked()
    expect(screen.getByLabelText("Currency")).toBeChecked()
    expect(screen.getByLabelText("Narrative")).not.toBeChecked()

    // Opt in to Narrative for this copy
    await user.click(screen.getByLabelText("Narrative"))
    await submitCopyDialog(user)

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0][0]).toContain("Description")

    // Re-opening remembers the Narrative opt-in from the previous copy
    await openCopyDialog(user)
    expect(screen.getByLabelText("Narrative")).toBeChecked()
  })

  test("cancelling the dialog does not copy anything", async () => {
    const { user, writeText } = setupWithClipboardSpy()
    const { default: PlanDetailPage } =
      await import("../../../../../../src/pages/rebalance/models/[modelId]/plans/[planId]")

    render(<PlanDetailPage />)
    await screen.findByText("Target Allocations")

    await openCopyDialog(user)
    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(writeText).not.toHaveBeenCalled()
    expect(screen.queryByLabelText("Narrative")).not.toBeInTheDocument()
  })
})
