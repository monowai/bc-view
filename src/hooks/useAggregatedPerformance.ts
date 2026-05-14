import useSwr from "swr"
import { Portfolio } from "types/beancounter"

/**
 * Aggregated performance shape mirroring the backend
 * `AggregatedPerformanceDataPoint` contract.
 *
 * Composite TWR (`growthOf1000`, `cumulativeReturn`) is chained sub-period
 * with beginning-of-sub-period AUM weights in display currency. Period
 * metrics (`netContributions`, `cumulativeDividends`, `investmentGain`) are
 * baselined from `series[0]` — zero at t=0.
 */
export interface AggregatedDataPoint {
  date: string
  marketValue: number
  netContributions: number
  lifetimeContributions: number
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

interface AggregateApiResponse {
  data: {
    series: AggregatedDataPoint[]
  }
}

/**
 * Fetches a backend-aggregated composite TWR series.
 *
 * The backend (`POST /performance/aggregate`) does all the work: pulls each
 * portfolio's cached TWR, FX-converts to `displayCurrencyCode`, builds the
 * union of valuation dates, chains sub-period AUM-weighted composite TWR,
 * and baselines period-relative metrics.
 */
export function useAggregatedPerformance(
  portfolios: Portfolio[],
  months: number,
  displayCurrencyCode: string | null,
  enabled: boolean,
): AggregatedPerformance {
  const portfolioCodes = portfolios.map((p) => p.code)
  const key =
    enabled && portfolioCodes.length > 0 && displayCurrencyCode
      ? `aggregated-perf:${portfolioCodes.join(",")}:${months}:${displayCurrencyCode}`
      : null

  const { data, isLoading, error } = useSwr<AggregatedDataPoint[]>(
    key,
    async () => {
      const res = await fetch(`/api/performance/aggregate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioCodes,
          months,
          displayCurrency: displayCurrencyCode,
        }),
      })
      if (!res.ok) {
        throw new Error(`Aggregate request failed: ${res.status}`)
      }
      const json: AggregateApiResponse = await res.json()
      return json.data?.series ?? []
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
    },
  )

  return {
    series: data ?? [],
    isLoading,
    error,
  }
}
