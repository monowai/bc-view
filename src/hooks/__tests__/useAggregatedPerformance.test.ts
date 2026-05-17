import { renderHook } from "@testing-library/react"
import {
  useAggregatedPerformance,
  AggregatedDataPoint,
} from "../useAggregatedPerformance"
import { Portfolio, Currency } from "types/beancounter"
import useSwr from "swr"

jest.mock("swr")
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

const makeCurrency = (code: string): Currency => ({
  code,
  name: code,
  symbol: "$",
})

const makePortfolio = (code: string, currencyCode: string): Portfolio => ({
  id: code,
  code,
  name: code,
  currency: makeCurrency(currencyCode),
  base: makeCurrency(currencyCode),
  marketValue: 10000,
  irr: 0.05,
})

type CapturedFetcher = (() => Promise<unknown>) | null

const captureFetcher = (): { ref: { current: CapturedFetcher } } => {
  const ref: { current: CapturedFetcher } = { current: null }
  mockUseSwr.mockImplementation((_key: unknown, fetcher: unknown) => {
    if (typeof fetcher === "function") {
      ref.current = fetcher as () => Promise<unknown>
    }
    return {
      data: undefined,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>
  })
  return { ref }
}

describe("useAggregatedPerformance", () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    mockUseSwr.mockReset()
    originalFetch = global.fetch
  })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("returns empty series when no portfolios", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    const { result } = renderHook(() =>
      useAggregatedPerformance([], 12, "USD", true),
    )

    expect(mockUseSwr).toHaveBeenCalledWith(
      null,
      expect.any(Function),
      expect.any(Object),
    )
    expect(result.current.series).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it("returns empty series when enabled is false", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    const portfolios = [makePortfolio("TEST", "USD")]
    const { result } = renderHook(() =>
      useAggregatedPerformance(portfolios, 12, "USD", false),
    )

    expect(mockUseSwr).toHaveBeenCalledWith(
      null,
      expect.any(Function),
      expect.any(Object),
    )
    expect(result.current.series).toEqual([])
  })

  it("passes a stable SWR key including codes, months, displayCurrency", () => {
    mockUseSwr.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    } as unknown as ReturnType<typeof useSwr>)

    const portfolios = [makePortfolio("P1", "USD"), makePortfolio("P2", "NZD")]
    renderHook(() => useAggregatedPerformance(portfolios, 6, "USD", true))

    expect(mockUseSwr).toHaveBeenCalledWith(
      "aggregated-perf:P1,P2:6:USD",
      expect.any(Function),
      expect.any(Object),
    )
  })

  it("returns isLoading true while fetching", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    const portfolios = [makePortfolio("P1", "USD")]
    const { result } = renderHook(() =>
      useAggregatedPerformance(portfolios, 12, "USD", true),
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.series).toEqual([])
  })

  it("returns error from SWR", () => {
    const err = new Error("Network failure")
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: err,
    } as unknown as ReturnType<typeof useSwr>)

    const portfolios = [makePortfolio("P1", "USD")]
    const { result } = renderHook(() =>
      useAggregatedPerformance(portfolios, 12, "USD", true),
    )

    expect(result.current.error).toBe(err)
    expect(result.current.series).toEqual([])
  })

  it("POSTs portfolioCodes, months, displayCurrency to /api/performance/aggregate", async () => {
    const { ref } = captureFetcher()
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { series: [] } }),
    })
    global.fetch = fetchMock as unknown as typeof global.fetch

    renderHook(() =>
      useAggregatedPerformance(
        [makePortfolio("P1", "USD"), makePortfolio("P2", "NZD")],
        6,
        "USD",
        true,
      ),
    )

    await ref.current!()

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/performance/aggregate",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioCodes: ["P1", "P2"],
          months: 6,
          displayCurrency: "USD",
        }),
      }),
    )
  })

  it("passes the backend series through as-is (regression guard for double-baselining)", async () => {
    // Backend is the source of truth for period-relative metrics and composite
    // TWR. Hook must not re-baseline, re-weight, or otherwise mutate the series
    // — doing so would re-introduce the leak that prompted moving aggregation
    // server-side (3M view: TWR 1.55% yet investmentGain +$216K).
    const { ref } = captureFetcher()
    const backendSeries: AggregatedDataPoint[] = [
      {
        date: "2025-01-01",
        marketValue: 100000,
        netContributions: 0,
        lifetimeContributions: 80000,
        cumulativeDividends: 0,
        investmentGain: 0,
        growthOf1000: 1000,
        cumulativeReturn: 0,
      },
      {
        date: "2025-12-01",
        marketValue: 132000,
        netContributions: 20000,
        lifetimeContributions: 100000,
        cumulativeDividends: 0,
        investmentGain: 12000,
        growthOf1000: 1100,
        cumulativeReturn: 0.1,
      },
    ]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { series: backendSeries } }),
    }) as unknown as typeof global.fetch

    renderHook(() =>
      useAggregatedPerformance(
        [makePortfolio("P1", "USD"), makePortfolio("P2", "USD")],
        12,
        "USD",
        true,
      ),
    )

    const result = (await ref.current!()) as {
      series: AggregatedDataPoint[]
      xirr: number | null
    }

    expect(result.series).toEqual(backendSeries)
    expect(result.xirr).toBeNull()
    // Period-relative invariants the backend guarantees, asserted here so a
    // future hook-side mutation that violates them fails loudly.
    expect(result.series[0].netContributions).toBe(0)
    expect(result.series[0].investmentGain).toBe(0)
    expect(result.series[1].investmentGain).toBe(12000)
    // Bug repro guard: lifetime leak would push this to >= 32000.
    expect(result.series[1].investmentGain).toBeLessThan(32000)
  })

  it("surfaces xirr from backend response", async () => {
    const { ref } = captureFetcher()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { series: [], xirr: 0.082 } }),
    }) as unknown as typeof global.fetch

    renderHook(() =>
      useAggregatedPerformance([makePortfolio("P1", "USD")], 12, "USD", true),
    )

    const result = (await ref.current!()) as {
      series: AggregatedDataPoint[]
      xirr: number | null
    }
    expect(result.xirr).toBe(0.082)
  })

  it("defaults xirr to null when backend omits the field", async () => {
    const { ref } = captureFetcher()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { series: [] } }),
    }) as unknown as typeof global.fetch

    renderHook(() =>
      useAggregatedPerformance([makePortfolio("P1", "USD")], 12, "USD", true),
    )

    const result = (await ref.current!()) as {
      series: AggregatedDataPoint[]
      xirr: number | null
    }
    expect(result.xirr).toBeNull()
  })

  it("throws when backend responds with non-ok", async () => {
    const { ref } = captureFetcher()
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    }) as unknown as typeof global.fetch

    renderHook(() =>
      useAggregatedPerformance([makePortfolio("P1", "USD")], 12, "USD", true),
    )

    await expect(ref.current!()).rejects.toThrow(/500/)
  })
})
