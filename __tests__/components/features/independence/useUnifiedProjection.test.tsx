import { renderHook, act, waitFor } from "@testing-library/react"
import useSwr from "swr"
import {
  useUnifiedProjection,
  useFiProjectionSimple,
} from "@components/features/independence/useUnifiedProjection"
import type { RetirementPlan } from "types/independence"
import type { AssetBreakdown } from "@components/features/independence/useAssetBreakdown"

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))

const mockFetch = jest.fn()

const plan = {
  id: "p1",
  name: "Plan",
  expensesCurrency: "NZD",
  monthlyExpenses: 4000,
  pensionMonthly: 0,
  socialSecurityMonthly: 0,
  otherIncomeMonthly: 0,
  equityReturnRate: 0.07,
  cashReturnRate: 0.02,
  housingReturnRate: 0.03,
  inflationRate: 0.02,
  cashAllocation: 0.2,
  equityAllocation: 0.7,
  housingAllocation: 0.1,
} as unknown as RetirementPlan

const assets: AssetBreakdown = {
  liquidAssets: 100000,
  nonSpendableAssets: 5000,
  totalAssets: 105000,
  hasAssets: true,
  isLoaded: true,
} as AssetBreakdown

const projectionA = { data: { fiMetrics: { fiProgress: 10 } } }
const projectionB = { data: { fiMetrics: { fiProgress: 20 } } }

function ok(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response
}

function bodyOf(call: number): Record<string, unknown> {
  return JSON.parse(mockFetch.mock.calls[call][1].body)
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = mockFetch as unknown as typeof fetch
  mockFetch.mockResolvedValue(ok(projectionA))
  jest.spyOn(console, "error").mockImplementation(() => {})
})

describe("useUnifiedProjection", () => {
  it("projects automatically once plan and assets are ready", async () => {
    const { result } = renderHook(() => useUnifiedProjection({ plan, assets }))
    await waitFor(() => expect(result.current.projection).not.toBeNull())
    expect(mockFetch.mock.calls[0][0]).toBe("/api/independence/projection/p1")
    expect(bodyOf(0)).toMatchObject({
      currency: "NZD",
      liquidAssets: 100000,
      nonSpendableAssets: 5000,
    })
    expect(result.current.adjustedProjection).toEqual(projectionA.data)
    expect(result.current.isCalculating).toBe(false)
  })

  it("waits when the plan has no assets (owned plan)", () => {
    renderHook(() =>
      useUnifiedProjection({
        plan,
        assets: { ...assets, hasAssets: false } as AssetBreakdown,
      }),
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("does nothing while disabled or without a plan", () => {
    renderHook(() => useUnifiedProjection({ plan, assets, enabled: false }))
    renderHook(() => useUnifiedProjection({ plan: undefined, assets }))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("projects a shared plan without the viewer's assets", async () => {
    const { result } = renderHook(() =>
      useUnifiedProjection({
        plan,
        assets: { ...assets, hasAssets: false } as AssetBreakdown,
        isSharedPlan: true,
      }),
    )
    await waitFor(() => expect(result.current.projection).not.toBeNull())
    const body = bodyOf(0)
    expect(body).not.toHaveProperty("liquidAssets")
    expect(body).not.toHaveProperty("portfolioIds")
  })

  it("records the baseline when the scenario is at baseline", async () => {
    const { result } = renderHook(() =>
      useUnifiedProjection({ plan, assets, isAtBaseline: true }),
    )
    await waitFor(() =>
      expect(result.current.baselineProjection).not.toBeNull(),
    )
    expect(result.current.baselineProjection).toEqual(projectionA.data)
  })

  it("surfaces a refused projection as an error", async () => {
    mockFetch.mockResolvedValue({ ok: false } as Response)
    const { result } = renderHook(() => useUnifiedProjection({ plan, assets }))
    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.error?.message).toBe("Failed to fetch projection")
    expect(result.current.projection).toBeNull()
  })

  it("surfaces a thrown failure, wrapping non-Error values", async () => {
    mockFetch.mockRejectedValue("offline")
    const { result } = renderHook(() => useUnifiedProjection({ plan, assets }))
    await waitFor(() => expect(result.current.error?.message).toBe("offline"))
  })

  it("debounces a recalculation when liquid assets change", async () => {
    const { result, rerender } = renderHook(
      ({ a }) => useUnifiedProjection({ plan, assets: a }),
      { initialProps: { a: assets } },
    )
    await waitFor(() => expect(result.current.projection).not.toBeNull())
    mockFetch.mockResolvedValue(ok(projectionB))
    rerender({ a: { ...assets, liquidAssets: 200000 } as AssetBreakdown })
    await waitFor(
      () => expect(result.current.projection).toEqual(projectionB.data),
      { timeout: 2000 },
    )
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(bodyOf(1).liquidAssets).toBe(200000)
  })

  it("clears the baseline when the display currency changes away from it", async () => {
    const { result, rerender } = renderHook(
      ({ cur, base }) =>
        useUnifiedProjection({
          plan,
          assets,
          displayCurrency: cur,
          isAtBaseline: base,
        }),
      { initialProps: { cur: "NZD", base: true } },
    )
    await waitFor(() =>
      expect(result.current.baselineProjection).not.toBeNull(),
    )
    rerender({ cur: "USD", base: false })
    await waitFor(() => expect(result.current.baselineProjection).toBeNull(), {
      timeout: 2000,
    })
    expect(bodyOf(1).displayCurrency).toBe("USD")
  })

  it("sends the defined contribution override when given", async () => {
    const { result } = renderHook(() =>
      useUnifiedProjection({ plan, assets, definedContribution: 750 }),
    )
    await waitFor(() => expect(result.current.projection).not.toBeNull())
    expect(JSON.stringify(bodyOf(0))).toContain("750")
  })

  it("recalculates from scratch on request", async () => {
    const { result } = renderHook(() => useUnifiedProjection({ plan, assets }))
    await waitFor(() => expect(result.current.projection).not.toBeNull())
    act(() => result.current.recalculate())
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.projection).not.toBeNull())
  })

  it("clears state on reset", async () => {
    mockFetch.mockResolvedValue({ ok: false } as Response)
    const { result } = renderHook(() => useUnifiedProjection({ plan, assets }))
    await waitFor(() => expect(result.current.error).not.toBeNull())
    mockFetch.mockImplementation(() => new Promise(() => {}))
    act(() => result.current.resetProjection())
    expect(result.current.error).toBeNull()
    expect(result.current.projection).toBeNull()
  })
})

describe("useFiProjectionSimple", () => {
  const swrMock = useSwr as jest.Mock

  it("does not fetch without assets", () => {
    swrMock.mockReturnValue({ data: undefined, isLoading: false })
    const { result } = renderHook(() =>
      useFiProjectionSimple({
        plan,
        assets: { ...assets, hasAssets: false } as AssetBreakdown,
      }),
    )
    expect(swrMock.mock.calls[0][0]).toBeNull()
    expect(result.current.projection).toBeNull()
  })

  it("keys the request on the asset values and posts them", async () => {
    swrMock.mockReturnValue({
      data: projectionA,
      isLoading: false,
      error: undefined,
    })
    const { result } = renderHook(() =>
      useFiProjectionSimple({ plan, assets, displayCurrency: "USD" }),
    )
    expect(result.current.projection).toEqual(projectionA.data)
    const [key, fetcher] = swrMock.mock.calls[0]
    expect(key).toEqual(["/api/independence/projection/p1", 100000, 5000])
    mockFetch.mockResolvedValue(ok(projectionB))
    await expect(fetcher(key)).resolves.toEqual(projectionB)
    expect(bodyOf(0)).toEqual({
      currency: "NZD",
      displayCurrency: "USD",
      liquidAssets: 100000,
      nonSpendableAssets: 5000,
    })
  })

  it("rejects a failed projection fetch", async () => {
    swrMock.mockReturnValue({ data: undefined, isLoading: false })
    renderHook(() => useFiProjectionSimple({ plan, assets }))
    mockFetch.mockResolvedValue({ ok: false } as Response)
    await expect(
      swrMock.mock.calls[0][1](swrMock.mock.calls[0][0]),
    ).rejects.toThrow("Failed to fetch projection")
  })

  it("reports loading while holdings have not loaded, but not for an empty portfolio", () => {
    swrMock.mockReturnValue({ data: undefined, isLoading: false })
    const loading = renderHook(() =>
      useFiProjectionSimple({
        plan,
        assets: {
          ...assets,
          hasAssets: false,
          isLoaded: false,
        } as AssetBreakdown,
      }),
    )
    expect(loading.result.current.isLoading).toBe(true)
    const empty = renderHook(() =>
      useFiProjectionSimple({
        plan,
        assets: {
          ...assets,
          hasAssets: false,
          isLoaded: true,
        } as AssetBreakdown,
      }),
    )
    expect(empty.result.current.isLoading).toBe(false)
  })
})
