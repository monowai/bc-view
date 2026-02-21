import useSwr from "swr"
import { Portfolio, PerformanceResponse } from "types/beancounter"

export interface AggregatedDataPoint {
  date: string
  marketValue: number
  netContributions: number
  cumulativeDividends: number
  investmentGain: number
  growthOf1000: number
  cumulativeReturn: number
}

export interface AggregatedPerformance {
  series: AggregatedDataPoint[]
  isLoading: boolean
  error: Error | undefined
}

/**
 * Fetch performance data for all portfolios in parallel, FX-convert,
 * and aggregate into a single time series.
 */
export function useAggregatedPerformance(
  portfolios: Portfolio[],
  months: number,
  fxRates: Record<string, number>,
  displayCurrencyCode: string | null,
  enabled: boolean,
): AggregatedPerformance {
  // Build a stable SWR key — null disables fetching
  const key =
    enabled && portfolios.length > 0 && displayCurrencyCode
      ? `aggregated-perf:${portfolios.map((p) => p.code).join(",")}:${months}:${displayCurrencyCode}`
      : null

  const { data, isLoading, error } = useSwr<AggregatedDataPoint[]>(
    key,
    async () => {
      // Fetch all portfolios in parallel
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

      // Collect successful results with FX conversion
      const seriesMap = new Map<string, AggregatedDataPoint>()

      for (const result of results) {
        if (result.status !== "fulfilled") continue
        const { portfolio, series } = result.value
        const rate = fxRates[portfolio.currency.code] ?? 1

        for (const point of series) {
          const existing = seriesMap.get(point.date)
          const mv = point.marketValue * rate
          const contrib = point.netContributions * rate
          const divs = point.cumulativeDividends * rate

          if (existing) {
            existing.marketValue += mv
            existing.netContributions += contrib
            existing.cumulativeDividends += divs
          } else {
            seriesMap.set(point.date, {
              date: point.date,
              marketValue: mv,
              netContributions: contrib,
              cumulativeDividends: divs,
              investmentGain: 0, // computed below
              growthOf1000: 0,
              cumulativeReturn: 0,
            })
          }
        }
      }

      // Sort by date and compute derived metrics
      const sorted = Array.from(seriesMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      )

      if (sorted.length === 0) return []

      const initialMv = sorted[0].marketValue
      for (const point of sorted) {
        point.investmentGain = point.marketValue - point.netContributions
        if (initialMv !== 0) {
          point.growthOf1000 = 1000 * (point.marketValue / initialMv)
          point.cumulativeReturn = point.marketValue / initialMv - 1
        }
      }

      return sorted
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
