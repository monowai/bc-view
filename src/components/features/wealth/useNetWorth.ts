import { useMemo } from "react"
import useSwr from "swr"
import {
  Currency,
  NetWorth,
  NetWorthResponse,
  Portfolio,
} from "types/beancounter"
import { simpleFetcher } from "@utils/api/fetchHelper"

export interface UseNetWorthResult {
  netWorth: NetWorth | undefined
  isLoading: boolean
}

/**
 * Reads the net-worth headline from svc-position, in the display currency.
 *
 * The backend drives the numbers — nothing here converts, sums or
 * classifies. This hook only decides when to ask and which portfolios to
 * ask about.
 *
 * @param displayCurrency - Required by the endpoint; no fetch until known.
 * @param excludedPortfolioIds - When given, the request is scoped to
 *   `ids=<all minus excluded>`. An empty included set (every portfolio
 *   excluded, or portfolios not yet loaded) suppresses the fetch rather
 *   than falling through to svc-position's "no ids = all portfolios"
 *   default — the same guard useNetWorthData applies to holdings.
 * @param portfolios - The user's portfolios, needed to derive the included
 *   set when exclusions apply.
 */
export function useNetWorth(
  displayCurrency: Currency | null,
  excludedPortfolioIds?: string[],
  portfolios: Portfolio[] = [],
): UseNetWorthResult {
  const key = useMemo(() => {
    if (!displayCurrency) return null
    const params = new URLSearchParams({
      asAt: "today",
      currency: displayCurrency.code,
    })
    if (excludedPortfolioIds !== undefined) {
      const excluded = new Set(excludedPortfolioIds)
      const includedIds = portfolios
        .filter((p) => !excluded.has(p.id))
        .map((p) => p.id)
      if (includedIds.length === 0) return null
      params.set("ids", includedIds.join(","))
    }
    return `/api/net-worth?${params.toString()}`
  }, [displayCurrency, excludedPortfolioIds, portfolios])

  const { data, isLoading } = useSwr<NetWorthResponse>(
    key,
    key ? simpleFetcher(key) : null,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
    },
  )

  return { netWorth: data?.data, isLoading }
}
