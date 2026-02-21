import { renderHook } from "@testing-library/react"
import { useAggregatedPerformance } from "../useAggregatedPerformance"
import { Portfolio, Currency } from "types/beancounter"
import useSwr from "swr"

// Mock SWR so we can control the fetcher execution
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

describe("useAggregatedPerformance", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
  })

  it("returns empty series when no portfolios", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    const { result } = renderHook(() =>
      useAggregatedPerformance([], 12, {}, "USD", true),
    )

    // Key should be null (disabled) → no fetch
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
      useAggregatedPerformance(portfolios, 12, { USD: 1 }, "USD", false),
    )

    // Key should be null when disabled
    expect(mockUseSwr).toHaveBeenCalledWith(
      null,
      expect.any(Function),
      expect.any(Object),
    )
    expect(result.current.series).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it("passes correct SWR key when enabled", () => {
    mockUseSwr.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    } as unknown as ReturnType<typeof useSwr>)

    const portfolios = [makePortfolio("P1", "USD"), makePortfolio("P2", "NZD")]
    renderHook(() =>
      useAggregatedPerformance(
        portfolios,
        6,
        { USD: 1, NZD: 0.6 },
        "USD",
        true,
      ),
    )

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
      useAggregatedPerformance(portfolios, 12, { USD: 1 }, "USD", true),
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.series).toEqual([])
  })

  it("returns series data from SWR", () => {
    const mockData = [
      {
        date: "2025-01-01",
        marketValue: 8000,
        netContributions: 8000,
        cumulativeDividends: 0,
        investmentGain: 0,
        growthOf1000: 1000,
        cumulativeReturn: 0,
      },
      {
        date: "2025-02-01",
        marketValue: 8500,
        netContributions: 8000,
        cumulativeDividends: 50,
        investmentGain: 500,
        growthOf1000: 1063,
        cumulativeReturn: 0.0625,
      },
    ]

    mockUseSwr.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: undefined,
    } as unknown as ReturnType<typeof useSwr>)

    const portfolios = [makePortfolio("P1", "USD"), makePortfolio("P2", "USD")]
    const { result } = renderHook(() =>
      useAggregatedPerformance(portfolios, 12, { USD: 1 }, "USD", true),
    )

    expect(result.current.series).toHaveLength(2)
    expect(result.current.series[0].marketValue).toBe(8000)
    expect(result.current.series[1].investmentGain).toBe(500)
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
      useAggregatedPerformance(portfolios, 12, { USD: 1 }, "USD", true),
    )

    expect(result.current.error).toBe(err)
    expect(result.current.series).toEqual([])
  })

  it("exercises the SWR fetcher for two same-currency portfolios", async () => {
    // Capture the fetcher that useAggregatedPerformance passes to useSwr
    let capturedFetcher: (() => Promise<unknown>) | null = null
    mockUseSwr.mockImplementation((_key: unknown, fetcher: unknown) => {
      if (typeof fetcher === "function") {
        capturedFetcher = fetcher as () => Promise<unknown>
      }
      return {
        data: undefined,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>
    })

    const portfolios = [makePortfolio("P1", "USD"), makePortfolio("P2", "USD")]

    renderHook(() =>
      useAggregatedPerformance(portfolios, 12, { USD: 1 }, "USD", true),
    )

    expect(capturedFetcher).not.toBeNull()

    // Mock global fetch
    const dates = ["2025-01-01", "2025-02-01"]
    const makeSeries = (mv: number): object[] =>
      dates.map((date, i) => ({
        date,
        growthOf1000: 1000 + i * 10,
        marketValue: mv + i * 100,
        netContributions: mv,
        cumulativeReturn: (i * 100) / mv,
        cumulativeDividends: i * 5,
      }))

    const originalFetch = global.fetch
    global.fetch = jest.fn().mockImplementation((url: string) => {
      const data = url.includes("P1")
        ? { data: { currency: makeCurrency("USD"), series: makeSeries(5000) } }
        : { data: { currency: makeCurrency("USD"), series: makeSeries(3000) } }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
    })

    try {
      const result = await capturedFetcher!()
      const series = result as Array<{
        marketValue: number
        netContributions: number
      }>

      // First date: 5000 + 3000 = 8000
      expect(series[0].marketValue).toBe(8000)
      expect(series[0].netContributions).toBe(8000)
      // Second date: 5100 + 3100 = 8200
      expect(series[1].marketValue).toBe(8200)
    } finally {
      global.fetch = originalFetch
    }
  })

  it("exercises the SWR fetcher with FX conversion", async () => {
    let capturedFetcher: (() => Promise<unknown>) | null = null
    mockUseSwr.mockImplementation((_key: unknown, fetcher: unknown) => {
      if (typeof fetcher === "function") {
        capturedFetcher = fetcher as () => Promise<unknown>
      }
      return {
        data: undefined,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>
    })

    const portfolios = [
      makePortfolio("US_PORT", "USD"),
      makePortfolio("NZ_PORT", "NZD"),
    ]

    renderHook(() =>
      useAggregatedPerformance(
        portfolios,
        12,
        { USD: 1, NZD: 0.6 },
        "USD",
        true,
      ),
    )

    const dates = ["2025-01-01"]
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockImplementation((url: string) => {
      const mv = url.includes("US_PORT") ? 5000 : 10000
      const ccy = url.includes("US_PORT") ? "USD" : "NZD"
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              currency: makeCurrency(ccy),
              series: dates.map((date) => ({
                date,
                growthOf1000: 1000,
                marketValue: mv,
                netContributions: mv,
                cumulativeReturn: 0,
                cumulativeDividends: 0,
              })),
            },
          }),
      })
    })

    try {
      const result = await capturedFetcher!()
      const series = result as Array<{ marketValue: number }>
      // USD 5000 + NZD 10000 * 0.6 = 11000
      expect(series[0].marketValue).toBe(11000)
    } finally {
      global.fetch = originalFetch
    }
  })

  it("exercises the SWR fetcher with one portfolio failing", async () => {
    let capturedFetcher: (() => Promise<unknown>) | null = null
    mockUseSwr.mockImplementation((_key: unknown, fetcher: unknown) => {
      if (typeof fetcher === "function") {
        capturedFetcher = fetcher as () => Promise<unknown>
      }
      return {
        data: undefined,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>
    })

    const portfolios = [
      makePortfolio("OK", "USD"),
      makePortfolio("FAIL", "USD"),
    ]

    renderHook(() =>
      useAggregatedPerformance(portfolios, 12, { USD: 1 }, "USD", true),
    )

    const originalFetch = global.fetch
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes("FAIL")) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({}),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              currency: makeCurrency("USD"),
              series: [
                {
                  date: "2025-01-01",
                  growthOf1000: 1000,
                  marketValue: 5000,
                  netContributions: 5000,
                  cumulativeReturn: 0,
                  cumulativeDividends: 0,
                },
              ],
            },
          }),
      })
    })

    try {
      const result = await capturedFetcher!()
      const series = result as Array<{ marketValue: number }>
      // Only the OK portfolio data
      expect(series).toHaveLength(1)
      expect(series[0].marketValue).toBe(5000)
    } finally {
      global.fetch = originalFetch
    }
  })
})
