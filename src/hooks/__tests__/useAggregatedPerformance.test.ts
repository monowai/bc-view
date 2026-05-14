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

    it("forward-fills missing snapshots when portfolios have different date sets", async () => {
      // Real-world case: P1 cash flow on Feb-15 creates a valuation date that
      // P2 doesn't have. Without fill, MV at Feb-15 would drop to P2-only,
      // producing the sawtooth-spike chart artefact.
      const { ref } = captureFetcher()
      const seriesP1 = [
        {
          date: "2025-01-01",
          growthOf1000: 1000,
          marketValue: 100000,
          netContributions: 100000,
          cumulativeReturn: 0,
          cumulativeDividends: 0,
        },
        // No Feb-15 snapshot for P1
        {
          date: "2025-03-01",
          growthOf1000: 1100,
          marketValue: 115000,
          netContributions: 105000,
          cumulativeReturn: 0.1,
          cumulativeDividends: 0,
        },
      ]
      const seriesP2 = [
        {
          date: "2025-01-01",
          growthOf1000: 1000,
          marketValue: 50000,
          netContributions: 50000,
          cumulativeReturn: 0,
          cumulativeDividends: 0,
        },
        {
          date: "2025-02-15",
          growthOf1000: 1050,
          marketValue: 52500,
          netContributions: 50000,
          cumulativeReturn: 0.05,
          cumulativeDividends: 0,
        },
        {
          date: "2025-03-01",
          growthOf1000: 1080,
          marketValue: 54000,
          netContributions: 50000,
          cumulativeReturn: 0.08,
          cumulativeDividends: 0,
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

      const series = (await ref.current!()) as Array<{
        date: string
        marketValue: number
        growthOf1000: number
        lifetimeContributions: number
      }>

      // Union dates: Jan-01, Feb-15, Mar-01
      expect(series.map((s) => s.date)).toEqual([
        "2025-01-01",
        "2025-02-15",
        "2025-03-01",
      ])
      // Jan-01: 100k + 50k = 150k
      expect(series[0].marketValue).toBe(150000)
      // Feb-15: P1 missing -> forward-fill 100k; P2 = 52500 -> 152500
      // NOT 52500 (which would be the sawtooth bug)
      expect(series[1].marketValue).toBe(152500)
      // Mar-01: real snapshots both = 115000 + 54000 = 169000
      expect(series[2].marketValue).toBe(169000)

      // Lifetime contributions also forward-fill: Feb-15 = 100k (P1) + 50k (P2) = 150k
      expect(series[1].lifetimeContributions).toBe(150000)

      // Composite TWR at Feb-15: P1 carried 1.0, P2 1.05, weights 100/150=0.667 & 50/150=0.333
      // composite = 0.667*1.0 + 0.333*1.05 = 1.01667
      expect(series[1].growthOf1000).toBeCloseTo(1016.67, 1)
    })

    it("does not leak pre-window lifetime gain into period investmentGain (regression guard)", async () => {
      // Original bug (svc-position cache HIT path pre-fix): if the cache was
      // populated for a longer window, a shorter-window request returned a
      // per-portfolio series whose series[0] landed mid-window. When the
      // frontend unioned per-portfolio dates, a portfolio "appearing" at a
      // mid-window date contributed BOTH its current market value AND its
      // lifetime netContributions at that moment — leaking (mv - lifetimeContrib),
      // i.e. the portfolio's pre-window gain, into period investmentGain.
      // Reported symptom: 3M view showed TWR 1.55% yet investmentGain +$216K.
      //
      // Backend fix (PerformanceService.anchorToStartDate) now synthesises an
      // anchor at the requested startDate for every portfolio. This test pins
      // the contract from the consumer side: given anchored input where every
      // series[0].date == window start, period investmentGain reflects only
      // within-window market change, regardless of how much pre-window
      // unrealised gain (mv - lifetimeContrib) each portfolio carries in.
      const { ref } = captureFetcher()

      // P1: existed before window with $20k pre-window unrealised gain locked
      // in (mv 100k vs lifetime contrib 80k). $10k of further market gain
      // accrues within the window, no flows.
      const seriesP1 = [
        {
          date: "2025-01-01",
          growthOf1000: 1000,
          marketValue: 100000,
          netContributions: 80000,
          cumulativeReturn: 0,
          cumulativeDividends: 0,
        },
        {
          date: "2025-12-01",
          growthOf1000: 1100,
          marketValue: 110000,
          netContributions: 80000,
          cumulativeReturn: 0.1,
          cumulativeDividends: 0,
        },
      ]
      // P2: synthesised anchor at startDate (no activity yet). Deposit mid-window,
      // then $2k of real market gain.
      const seriesP2 = [
        {
          date: "2025-01-01",
          growthOf1000: 1000,
          marketValue: 0,
          netContributions: 0,
          cumulativeReturn: 0,
          cumulativeDividends: 0,
        },
        {
          date: "2025-06-01",
          growthOf1000: 1000,
          marketValue: 20000,
          netContributions: 20000,
          cumulativeReturn: 0,
          cumulativeDividends: 0,
        },
        {
          date: "2025-12-01",
          growthOf1000: 1100,
          marketValue: 22000,
          netContributions: 20000,
          cumulativeReturn: 0.1,
          cumulativeDividends: 0,
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

      const series = (await ref.current!()) as Array<{
        date: string
        marketValue: number
        netContributions: number
        lifetimeContributions: number
        investmentGain: number
      }>

      // Baseline t0: only P1 has MV; P2 anchor is zero.
      expect(series[0].marketValue).toBe(100000)
      expect(series[0].netContributions).toBe(0)
      expect(series[0].lifetimeContributions).toBe(80000)
      expect(series[0].investmentGain).toBe(0)

      // End-of-window: $20k flowed in (P2 deposit); $10k P1 gain + $2k P2 gain.
      // Period investmentGain = (132k − 100k) − 20k = 12k. NOT 32k (lifetime
      // leak) and NOT 52k (full mv − period contrib without anchoring).
      const last = series[series.length - 1]
      expect(last.marketValue).toBe(132000)
      expect(last.netContributions).toBe(20000)
      expect(last.lifetimeContributions).toBe(100000)
      expect(last.investmentGain).toBe(12000)
      // Bug repro guard: any leak of P1's pre-window $20k gain would surface
      // here as investmentGain >= 32000.
      expect(last.investmentGain).toBeLessThan(32000)
    })

    it("handles portfolio first appearing after window start (no negative skew)", async () => {
      // Pre-fix scenario: backend could return P2's series starting mid-window
      // (no anchor at requested startDate). Post-fix, every portfolio's series
      // begins at startDate, so this input shape is no longer produced in
      // production — but the frontend's defensive forward-fill is kept and
      // pinned here in case of backend regression or third-party data sources.
      const { ref } = captureFetcher()
      const seriesP1 = [
        {
          date: "2025-01-01",
          growthOf1000: 1000,
          marketValue: 100000,
          netContributions: 100000,
          cumulativeReturn: 0,
          cumulativeDividends: 0,
        },
        {
          date: "2025-06-01",
          growthOf1000: 1100,
          marketValue: 110000,
          netContributions: 100000,
          cumulativeReturn: 0.1,
          cumulativeDividends: 0,
        },
      ]
      const seriesP2 = [
        {
          date: "2025-06-01",
          growthOf1000: 1000,
          marketValue: 20000,
          netContributions: 20000,
          cumulativeReturn: 0,
          cumulativeDividends: 0,
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

      const series = (await ref.current!()) as Array<{
        date: string
        marketValue: number
      }>

      // Jan-01: only P1 active -> 100k (not 0)
      expect(series[0].marketValue).toBe(100000)
      // Jun-01: both -> 110k + 20k = 130k
      expect(series[1].marketValue).toBe(130000)
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
