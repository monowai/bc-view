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
import { usePrivateAssetConfigs } from "@utils/assets/usePrivateAssetConfigs"

export interface UseNetWorthDataResult {
  portfolios: Portfolio[]
  holdingsData: HoldingContract | undefined
  currencies: Currency[]
  displayCurrency: Currency | null
  setDisplayCurrency: (c: Currency) => void
  fxRates: Record<string, number>
  fxReady: boolean
  customAssetTotals: Record<string, number>
  healthcareReserveTotals: Record<string, number>
  isLoading: boolean
}

/**
 * Fetches all data needed to render a Net Worth breakdown — portfolios,
 * aggregated holdings, currencies, FX rates, and private-asset configs
 * (CPF / pension sub-account totals with double-count guard).
 *
 * Extracted from wealth.tsx so the composite NetWorthTab can reuse the
 * same data pipeline without duplicating the double-count guard logic.
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

  const { data: holdingsResponse, isLoading: holdingsLoading } = useSwr<{
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

  // Composite assets (CPF / pensions): same double-count guard as wealth.tsx.
  // Parent trn in a portfolio → CompositeValuation already includes balance.
  // Standalone (no parent trn) → top up via customAssetTotals.
  // CPF MA (Medisave) is statutory healthcare reserve → healthcareReserveTotals.
  const { configs: privateAssetConfigs } = usePrivateAssetConfigs()
  const portfolioAssetIds = useMemo(() => {
    const ids = new Set<string>()
    if (holdingsData?.positions) {
      Object.values(holdingsData.positions).forEach((position) => {
        const id = position.asset?.id
        if (id) ids.add(id)
      })
    }
    return ids
  }, [holdingsData])

  const { customAssetTotals, healthcareReserveTotals } = useMemo(() => {
    const customTotals: Record<string, number> = {}
    const reserveTotals: Record<string, number> = {}
    privateAssetConfigs.forEach((config) => {
      const subAccounts = config.subAccounts ?? []
      if (subAccounts.length === 0) return
      const currency = config.rentalCurrency || "USD"
      const parentInPortfolio = portfolioAssetIds.has(config.assetId)

      let nonReserve = 0
      let reserve = 0
      subAccounts.forEach((sa) => {
        const balance = sa.balance || 0
        if (balance === 0) return
        if (sa.code === "MA") {
          reserve += balance
        } else {
          nonReserve += balance
        }
      })

      if (reserve > 0) {
        reserveTotals[currency] = (reserveTotals[currency] || 0) + reserve
      }
      if (!parentInPortfolio && nonReserve > 0) {
        customTotals[currency] = (customTotals[currency] || 0) + nonReserve
      }
    })
    return {
      customAssetTotals: customTotals,
      healthcareReserveTotals: reserveTotals,
    }
  }, [privateAssetConfigs, portfolioAssetIds])

  const sourceCurrencyCodes = useMemo(
    () => [
      ...portfolios.map((p) => p.base.code),
      ...portfolios.map((p) => p.currency.code),
      ...Object.keys(customAssetTotals),
      ...Object.keys(healthcareReserveTotals),
    ],
    [portfolios, customAssetTotals, healthcareReserveTotals],
  )

  const { displayCurrency, setDisplayCurrency, fxRates, fxReady } = useFxRates(
    currencies,
    sourceCurrencyCodes,
  )

  // Gate on both portfolio and holdings loading: the double-count guard in
  // customAssetTotals keys off portfolioAssetIds (derived from holdingsData).
  // Rendering before holdings arrive would temporarily double-count composite
  // assets already included via portfolio.marketValue.
  const isLoading = portfolioLoading || holdingsLoading || !fxReady

  return {
    portfolios,
    holdingsData,
    currencies,
    displayCurrency,
    setDisplayCurrency,
    fxRates,
    fxReady,
    customAssetTotals,
    healthcareReserveTotals,
    isLoading,
  }
}
