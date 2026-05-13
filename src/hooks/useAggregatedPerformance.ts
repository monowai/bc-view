import useSwr from "swr"
import { Portfolio, PerformanceResponse } from "types/beancounter"

export interface AggregatedDataPoint {
  date: string
  marketValue: number
  /** Period-relative net external cash flows (deposits − withdrawals) WITHIN the requested window. */
  netContributions: number
  /** Lifetime-cumulative net external cash flows up to this date (for context/tooltip). */
  lifetimeContributions: number
  /** Period-relative dividends. */
  cumulativeDividends: number
  /** Period gain: (MV − MV₀) − periodContributions. */
  investmentGain: number
  /** Composite TWR growth-of-1000, beginning-AUM weighted across portfolios. */
  growthOf1000: number
  /** Composite TWR as decimal (0.10 = +10%). */
  cumulativeReturn: number
}

export interface AggregatedPerformance {
  series: AggregatedDataPoint[]
  isLoading: boolean
  error: Error | undefined
}

interface PortfolioSnapshot {
  date: string
  growthFactor: number // backend growthOf1000 / 1000
  mv: number // display ccy
  contrib: number // lifetime, display ccy
  divs: number // lifetime, display ccy
}

interface PortfolioSeriesFx {
  /** FX-converted into display currency. */
  startMv: number
  /** Snapshots sorted by date ascending. Used for forward-fill on union dates. */
  snapshots: PortfolioSnapshot[]
}

/**
 * Fetch performance data for all portfolios in parallel, FX-convert,
 * and aggregate into a single time series.
 *
 * Returns period-relative values aligned with GIPS composite TWR conventions:
 * - cumulativeReturn / growthOf1000: beginning-AUM weighted composite TWR (uses
 *   the backend's per-portfolio TWR `growthOf1000`, not a naïve MV ratio).
 * - netContributions: cash flows within the requested window only.
 * - lifetimeContributions: total inception-to-date contributions, for tooltip.
 * - investmentGain: (MV_t − MV_0) − periodContributions.
 */
export function useAggregatedPerformance(
  portfolios: Portfolio[],
  months: number,
  fxRates: Record<string, number>,
  displayCurrencyCode: string | null,
  enabled: boolean,
): AggregatedPerformance {
  const key =
    enabled && portfolios.length > 0 && displayCurrencyCode
      ? `aggregated-perf:${portfolios.map((p) => p.code).join(",")}:${months}:${displayCurrencyCode}`
      : null

  const { data, isLoading, error } = useSwr<AggregatedDataPoint[]>(
    key,
    async () => {
      const results = await Promise.allSettled(
        portfolios.map(async (portfolio) => {
          const res = await fetch(
            `/api/performance/${portfolio.code}?months=${months}`,
          )
          if (!res.ok) throw new Error(`Failed for ${portfolio.code}`)
          const json: PerformanceResponse = await res.json()
          return { portfolio, series: json.data?.series || [] }
        }),
      )

      // Per-portfolio normalised series in display currency
      const perPortfolio: PortfolioSeriesFx[] = []
      const allDates = new Set<string>()

      for (const result of results) {
        if (result.status !== "fulfilled") continue
        const { portfolio, series } = result.value
        if (series.length === 0) continue
        const rate = fxRates[portfolio.currency.code] ?? 1

        const snapshots: PortfolioSnapshot[] = series
          .map((point) => {
            allDates.add(point.date)
            return {
              date: point.date,
              growthFactor: point.growthOf1000 / 1000,
              mv: point.marketValue * rate,
              contrib: point.netContributions * rate,
              divs: point.cumulativeDividends * rate,
            }
          })
          .sort((a, b) => a.date.localeCompare(b.date))

        perPortfolio.push({
          startMv: snapshots[0].mv,
          snapshots,
        })
      }

      if (perPortfolio.length === 0) return []

      const totalStartMv = perPortfolio.reduce((sum, p) => sum + p.startMv, 0)
      const sortedDates = Array.from(allDates).sort((a, b) =>
        a.localeCompare(b),
      )

      // Forward-fill state per portfolio: cursor advances as we walk union dates.
      // When a portfolio has no snapshot on date d, we carry the last-seen snapshot.
      // Required because each portfolio's valuation dates differ (cash-flow dates
      // are portfolio-specific) — without fill, the aggregated MV would zigzag
      // wildly between $0 and full value as portfolios drop in and out.
      const cursors: number[] = perPortfolio.map(() => 0)

      const aggregated: AggregatedDataPoint[] = []
      let baselineMv = 0
      let baselineContrib = 0
      let baselineDivs = 0

      for (let i = 0; i < sortedDates.length; i++) {
        const date = sortedDates[i]
        let mv = 0
        let contrib = 0
        let divs = 0
        let compositeGrowth = 0
        let weightSumPresent = 0

        for (let pi = 0; pi < perPortfolio.length; pi++) {
          const p = perPortfolio[pi]
          // Advance cursor while next snapshot is on/before this date
          while (
            cursors[pi] + 1 < p.snapshots.length &&
            p.snapshots[cursors[pi] + 1].date <= date
          ) {
            cursors[pi]++
          }
          const point = p.snapshots[cursors[pi]]
          // Skip portfolios whose first snapshot is later than this date (they
          // didn't exist yet within the requested window).
          if (point.date > date) continue

          mv += point.mv
          contrib += point.contrib
          divs += point.divs
          if (totalStartMv > 0) {
            const w = p.startMv / totalStartMv
            compositeGrowth += w * point.growthFactor
            weightSumPresent += w
          }
        }

        // Renormalise composite growth if some portfolios are not yet active
        const growthFactor =
          weightSumPresent > 0 ? compositeGrowth / weightSumPresent : 1
        const growthOf1000 = 1000 * growthFactor
        const cumulativeReturn = growthFactor - 1

        if (i === 0) {
          baselineMv = mv
          baselineContrib = contrib
          baselineDivs = divs
        }

        const periodContrib = contrib - baselineContrib
        const periodDivs = divs - baselineDivs
        const investmentGain = mv - baselineMv - periodContrib

        aggregated.push({
          date,
          marketValue: mv,
          netContributions: periodContrib,
          lifetimeContributions: contrib,
          cumulativeDividends: periodDivs,
          investmentGain,
          growthOf1000,
          cumulativeReturn,
        })
      }

      return aggregated
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
    },
  )

  return {
    series: data || [],
    isLoading,
    error,
  }
}
