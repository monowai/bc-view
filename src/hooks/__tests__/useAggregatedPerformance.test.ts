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

  describe("period-relative aggregation", () => {
    const mockFetchSingle = (
      series: Array<{
        date: string
        growthOf1000: number
        marketValue: number
        netContributions: number
        cumulativeDividends: number
        cumulativeReturn: number
      }>,
      currency = "USD",
    ): void => {
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { currency: makeCurrency(currency), series },
            }),
        }),
      ) as unknown as typeof global.fetch
    }

    let originalFetch: typeof global.fetch
    beforeEach(() => {
      originalFetch = global.fetch
    })
    afterEach(() => {
      global.fetch = originalFetch
    })

    it("period netContributions = 0 at first snapshot (lifetime baseline removed)", async () => {
      const { ref } = captureFetcher()
      mockFetchSingle([
        {
          date: "2025-01-01",
          growthOf1000: 1000,
          marketValue: 100000,
          netContributions: 80000, // lifetime contributions before window
          cumulativeDividends: 0,
          cumulativeReturn: 0,
        },
        {
          date: "2025-12-01",
          growthOf1000: 1100,
          marketValue: 115000,
          netContributions: 85000, // +5000 deposited during window
          cumulativeDividends: 500,
          cumulativeReturn: 0.1,
        },
      ])

      renderHook(() =>
        useAggregatedPerformance(
          [makePortfolio("P1", "USD")],
          12,
          { USD: 1 },
          "USD",
          true,
        ),
      )

      const result = (await ref.current!()) as Array<{
        netContributions: number
        lifetimeContributions: number
      }>
      expect(result[0].netContributions).toBe(0)
      expect(result[1].netContributions).toBe(5000)
      expect(result[0].lifetimeContributions).toBe(80000)
      expect(result[1].lifetimeContributions).toBe(85000)
    })

    it("investmentGain is period MV change minus period contributions, not MV - lifetime contrib", async () => {
      const { ref } = captureFetcher()
      mockFetchSingle([
        {
          date: "2025-01-01",
          growthOf1000: 1000,
          marketValue: 100000,
          netContributions: 80000, // historical contributions
          cumulativeDividends: 0,
          cumulativeReturn: 0,
        },
        {
          date: "2025-12-01",
          growthOf1000: 1100,
          marketValue: 115000, // +15k MV with +5k deposit -> +10k pure gain
          netContributions: 85000,
          cumulativeDividends: 0,
          cumulativeReturn: 0.1,
        },
      ])

      renderHook(() =>
        useAggregatedPerformance(
          [makePortfolio("P1", "USD")],
          12,
          { USD: 1 },
          "USD",
          true,
        ),
      )

      const result = (await ref.current!()) as Array<{ investmentGain: number }>
      // Period gain = (115000 - 100000) - 5000 = 10000 (NOT 115000 - 85000 = 30000)
      expect(result[1].investmentGain).toBe(10000)
      // Bug repro guard: must not equal lifetime-style gain
      expect(result[1].investmentGain).not.toBe(30000)
    })

    it("cumulativeReturn uses backend TWR, not naive MV/MV0 ratio", async () => {
      // Backend's growthOf1000 already neutralises cash flows.
      // MV doubles (100k -> 200k) because of deposit, not investment performance.
      // TWR = 0%; naive MV/MV0 = 100%.
      const { ref } = captureFetcher()
      mockFetchSingle([
        {
          date: "2025-01-01",
          growthOf1000: 1000,
          marketValue: 100000,
          netContributions: 50000,
          cumulativeDividends: 0,
          cumulativeReturn: 0,
        },
        {
          date: "2025-12-01",
          growthOf1000: 1000, // no investment performance
          marketValue: 200000, // 100k deposit
          netContributions: 150000,
          cumulativeDividends: 0,
          cumulativeReturn: 0,
        },
      ])

      renderHook(() =>
        useAggregatedPerformance(
          [makePortfolio("P1", "USD")],
          12,
          { USD: 1 },
          "USD",
          true,
        ),
      )

      const result = (await ref.current!()) as Array<{
        cumulativeReturn: number
        growthOf1000: number
      }>
      expect(result[1].cumulativeReturn).toBeCloseTo(0, 6)
      expect(result[1].growthOf1000).toBeCloseTo(1000, 6)
    })

    it("composite TWR is beginning-AUM weighted across portfolios", async () => {
      // P1 starts 60k, ends with TWR +20% (growthOf1000 1200)
      // P2 starts 40k, ends with TWR +5%  (growthOf1000 1050)
      // weight P1=0.6, P2=0.4
      // composite growth factor = 0.6*1.20 + 0.4*1.05 = 0.72 + 0.42 = 1.14
      // composite cumulativeReturn = 0.14 (NOT 0.125 equal-weighted)
      const { ref } = captureFetcher()

      const seriesP1 = [
        {
          date: "2025-01-01",
          growthOf1000: 1000,
          marketValue: 60000,
          netContributions: 60000,
          cumulativeDividends: 0,
          cumulativeReturn: 0,
        },
        {
          date: "2025-12-01",
          growthOf1000: 1200,
          marketValue: 72000,
          netContributions: 60000,
          cumulativeDividends: 0,
          cumulativeReturn: 0.2,
        },
      ]
      const seriesP2 = [
        {
          date: "2025-01-01",
          growthOf1000: 1000,
          marketValue: 40000,
          netContributions: 40000,
          cumulativeDividends: 0,
          cumulativeReturn: 0,
        },
        {
          date: "2025-12-01",
          growthOf1000: 1050,
          marketValue: 42000,
          netContributions: 40000,
          cumulativeDividends: 0,
          cumulativeReturn: 0.05,
        },
      ]

      global.fetch = jest.fn().mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                currency: makeCurrency("USD"),
                series: url.includes("P1") ? seriesP1 : seriesP2,
              },
            }),
        }),
      ) as unknown as typeof global.fetch

      renderHook(() =>
        useAggregatedPerformance(
          [makePortfolio("P1", "USD"), makePortfolio("P2", "USD")],
          12,
          { USD: 1 },
          "USD",
          true,
        ),
      )

      const result = (await ref.current!()) as Array<{
        cumulativeReturn: number
        growthOf1000: number
        marketValue: number
      }>
      expect(result[1].cumulativeReturn).toBeCloseTo(0.14, 5)
      expect(result[1].growthOf1000).toBeCloseTo(1140, 2)
      expect(result[1].marketValue).toBe(114000)
    })

    it("composite TWR weights by display-currency initial MV (FX-aware)", async () => {
      // P_USD 50k USD @ TWR +10%
      // P_NZD 100k NZD @ 0.6 = 60k USD initial @ TWR +20%
      // weight USD = 50/110, NZD = 60/110
      // composite = 50/110 * 1.10 + 60/110 * 1.20 = 0.55 + 0.7272727... = 1.15454...
      const { ref } = captureFetcher()
      global.fetch = jest.fn().mockImplementation((url: string) => {
        const series = url.includes("US_PORT")
          ? [
              {
                date: "2025-01-01",
                growthOf1000: 1000,
                marketValue: 50000,
                netContributions: 50000,
                cumulativeDividends: 0,
                cumulativeReturn: 0,
              },
              {
                date: "2025-12-01",
                growthOf1000: 1100,
                marketValue: 55000,
                netContributions: 50000,
                cumulativeDividends: 0,
                cumulativeReturn: 0.1,
              },
            ]
          : [
              {
                date: "2025-01-01",
                growthOf1000: 1000,
                marketValue: 100000,
                netContributions: 100000,
                cumulativeDividends: 0,
                cumulativeReturn: 0,
              },
              {
                date: "2025-12-01",
                growthOf1000: 1200,
                marketValue: 120000,
                netContributions: 100000,
                cumulativeDividends: 0,
                cumulativeReturn: 0.2,
              },
            ]
        const ccy = url.includes("US_PORT") ? "USD" : "NZD"
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { currency: makeCurrency(ccy), series },
            }),
        })
      }) as unknown as typeof global.fetch

      renderHook(() =>
        useAggregatedPerformance(
          [makePortfolio("US_PORT", "USD"), makePortfolio("NZ_PORT", "NZD")],
          12,
          { USD: 1, NZD: 0.6 },
          "USD",
          true,
        ),
      )

      const result = (await ref.current!()) as Array<{
        cumulativeReturn: number
        marketValue: number
      }>
      // Expected composite return
      const expected = (50 / 110) * 1.1 + (60 / 110) * 1.2 - 1
      expect(result[1].cumulativeReturn).toBeCloseTo(expected, 5)
      // Initial MV in USD = 50000 + 100000*0.6 = 110000
      expect(result[0].marketValue).toBe(110000)
      // End MV in USD = 55000 + 120000*0.6 = 127000
      expect(result[1].marketValue).toBe(127000)
    })

    it("aggregates same-currency portfolios — period contrib summed, lifetime summed", async () => {
      const { ref } = captureFetcher()
      const dates = ["2025-01-01", "2025-02-01"]
      const makeSeries = (mv: number): object[] =>
        dates.map((date, i) => ({
          date,
          growthOf1000: 1000 + i * 10,
          marketValue: mv + i * 100,
          netContributions: mv,
          cumulativeReturn: (i * 10) / 1000,
          cumulativeDividends: i * 5,
        }))

      global.fetch = jest.fn().mockImplementation((url: string) => {
        const data = url.includes("P1")
          ? {
              data: { currency: makeCurrency("USD"), series: makeSeries(5000) },
            }
          : {
              data: { currency: makeCurrency("USD"), series: makeSeries(3000) },
            }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
      }) as unknown as typeof global.fetch

      renderHook(() =>
        useAggregatedPerformance(
          [makePortfolio("P1", "USD"), makePortfolio("P2", "USD")],
          12,
          { USD: 1 },
          "USD",
          true,
        ),
      )

      const series = (await ref.current!()) as Array<{
        marketValue: number
        netContributions: number
        lifetimeContributions: number
      }>

      expect(series[0].marketValue).toBe(8000)
      // Period contribution at t0 = 0 (no flows within window)
      expect(series[0].netContributions).toBe(0)
      // Lifetime sum = 5000 + 3000 = 8000
      expect(series[0].lifetimeContributions).toBe(8000)
      expect(series[1].marketValue).toBe(8200)
    })

    it("FX-converts MV when aggregating multi-currency portfolios", async () => {
      const { ref } = captureFetcher()
      global.fetch = jest.fn().mockImplementation((url: string) => {
        const mv = url.includes("US_PORT") ? 5000 : 10000
        const ccy = url.includes("US_PORT") ? "USD" : "NZD"
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                currency: makeCurrency(ccy),
                series: [
                  {
                    date: "2025-01-01",
                    growthOf1000: 1000,
                    marketValue: mv,
                    netContributions: mv,
                    cumulativeReturn: 0,
                    cumulativeDividends: 0,
                  },
                ],
              },
            }),
        })
      }) as unknown as typeof global.fetch

      renderHook(() =>
        useAggregatedPerformance(
          [makePortfolio("US_PORT", "USD"), makePortfolio("NZ_PORT", "NZD")],
          12,
          { USD: 1, NZD: 0.6 },
          "USD",
          true,
        ),
      )

      const series = (await ref.current!()) as Array<{ marketValue: number }>
      expect(series[0].marketValue).toBe(11000)
    })

    it("drops failed portfolios silently", async () => {
      const { ref } = captureFetcher()
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("FAIL")) {
          return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
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
      }) as unknown as typeof global.fetch

      renderHook(() =>
        useAggregatedPerformance(
          [makePortfolio("OK", "USD"), makePortfolio("FAIL", "USD")],
          12,
          { USD: 1 },
          "USD",
          true,
        ),
      )

      const series = (await ref.current!()) as Array<{ marketValue: number }>
      expect(series).toHaveLength(1)
      expect(series[0].marketValue).toBe(5000)
    })
  })
})
