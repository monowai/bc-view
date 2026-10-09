import { useMemo } from "react"
import useSwr from "swr"
import { Portfolio, Currency, HoldingContract } from "types/beancounter"
import {
  portfoliosKey,
  simpleFetcher,
  ccyKey,
  holdingKey,
} from "@utils/api/fetchHelper"
import { useFxRates } from "@hooks/useFxRates"

export interface UseNetWorthDataResult {
  portfolios: Portfolio[]
  holdingsData: HoldingContract | undefined
  currencies: Currency[]
  displayCurrency: Currency | null
  setDisplayCurrency: (c: Currency) => void
  fxRates: Record<string, number>
  fxReady: boolean
  isLoading: boolean
}

/**
 * Fetches the supporting data around a Net Worth view — portfolios,
 * aggregated holdings (for the allocation charts), currencies and FX
 * rates. The headline itself comes from svc-position via `useNetWorth`;
 * nothing here sums or classifies.
 *
 * wealth.tsx is NOT refactored to consume this hook — the page has
 * additional state (sort, collapse, TWR visibility) that makes a
 * low-risk extraction harder than it's worth.
 *
 * @param excludedPortfolioIds - When provided, the aggregated holdings fetch
 *   is scoped to only the included portfolios (all minus excluded). Prevents
 *   the classification breakdown from including positions belonging to
 *   portfolios the user has deselected. When omitted, all portfolios are
 *   fetched (existing behaviour, preserves compatibility for other callers).
 *   While portfolios are still loading the holdings fetch is suppressed
 *   (null SWR key) to avoid svc-position's "no ids = all portfolios"
 *   fallback — same guard used in useIndependencePlanData.
 */
export function useNetWorthData(
  excludedPortfolioIds?: string[],
): UseNetWorthDataResult {
  const { data: portfolioData, isLoading: portfolioLoading } = useSwr(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )

  // Derive portfolios early so the holdings URL can be scoped to included ids.
  const portfolios: Portfolio[] = useMemo(
    () => portfolioData?.data || [],
    [portfolioData?.data],
  )

  // Build the holdings SWR key.
  // When excludedPortfolioIds is provided, scope the fetch to the included
  // subset. While portfolios are loading (portfolios=[]), the included set
  // is empty — null key suppresses the fetch until the set resolves, avoiding
  // the svc-position "no ids = all portfolios" fallback.
  const holdingKeyUrl = useMemo(() => {
    if (excludedPortfolioIds === undefined) {
      // Default: unscoped (preserves existing behaviour for callers that do
      // not pass excluded ids — e.g. wealth.tsx, debug.tsx).
      return holdingKey("aggregated", "today")
    }
    const excludedSet = new Set(excludedPortfolioIds)
    const includedIds = portfolios
      .filter((p) => !excludedSet.has(p.id))
      .map((p) => p.id)
    if (includedIds.length === 0) {
      // All portfolios excluded, or portfolios not yet loaded — skip fetch.
      return null
    }
    const params = new URLSearchParams({ asAt: "today" })
    params.set("ids", includedIds.join(","))
    return `/api/holdings/aggregated?${params.toString()}`
  }, [excludedPortfolioIds, portfolios])

  const { data: holdingsResponse } = useSwr<{
    data: HoldingContract
  }>(holdingKeyUrl, holdingKeyUrl ? simpleFetcher(holdingKeyUrl) : null, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
  })
  const holdingsData = holdingsResponse?.data

  const { data: currencyData } = useSwr<{ data: Currency[] }>(
    ccyKey,
    simpleFetcher(ccyKey),
  )

  const currencies = useMemo(
    () => currencyData?.data || [],
    [currencyData?.data],
  )

  const sourceCurrencyCodes = useMemo(
    () => [
      ...portfolios.map((p) => p.base.code),
      ...portfolios.map((p) => p.currency.code),
    ],
    [portfolios],
  )

  const { displayCurrency, setDisplayCurrency, fxRates, fxReady } = useFxRates(
    currencies,
    sourceCurrencyCodes,
  )

  // Holdings only feed the allocation charts now, so they are not gated on:
  // the headline is the server's and renders as soon as it arrives.
  const isLoading = portfolioLoading || !fxReady

  return {
    portfolios,
    holdingsData,
    currencies,
    displayCurrency,
    setDisplayCurrency,
    fxRates,
    fxReady,
    isLoading,
  }
}
