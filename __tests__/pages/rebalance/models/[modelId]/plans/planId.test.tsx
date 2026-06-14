import React from "react"
import { render, screen } from "@testing-library/react"

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
})
