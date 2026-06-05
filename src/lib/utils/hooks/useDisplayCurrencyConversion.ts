import { useEffect, useState } from "react"
import useSWR from "swr"
import { Currency, Portfolio, FxResponse } from "types/beancounter"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import { useHoldingState } from "@lib/holdings/holdingState"

const SWR_CURRENCIES_CONFIG = {
  revalidateOnFocus: false,
  dedupingInterval: 60_000,
}

// Cache for FX rates — keyed by "FROM:TO". Module-level because the same
// rate is reused across many components within a session.
const fxRateCache = new Map<string, { rate: number; timestamp: number }>()
const FX_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchFxRate(from: string, to: string): Promise<number> {
  if (from === to) return 1

  const cacheKey = `${from}:${to}`
  const cached = fxRateCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < FX_CACHE_TTL) {
    return cached.rate
  }

  try {
    const response = await fetch("/api/fx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rateDate: "today",
        pairs: [{ from, to }],
      }),
    })

    const fxResponse: FxResponse = await response.json()
    const rate = fxResponse.data?.rates?.[cacheKey]?.rate || 1

    fxRateCache.set(cacheKey, { rate, timestamp: Date.now() })
    return rate
  } catch (err) {
    console.error("Failed to fetch FX rate:", err)
    return 1
  }
}

export interface DisplayCurrencyConversion {
  /** Convert a value using the current FX rate */
  convert: (value: number) => number
  /**The effective currency symbol for display */
  currencySymbol: string
  /** The effective currency code for display */
  currencyCode: string
  /**Whether a custom display currency is active */
  isCustomCurrency: boolean
  /** Whether the FX rate is still loading */
  isLoading: boolean
}

interface UseDisplayCurrencyConversionProps {
  /** The source currency (what the values are denominated in) */
  sourceCurrency: Currency | undefined
  /**The portfolio for PORTFOLIO/BASE mode resolution*/
  portfolio: Portfolio
}

interface AsyncFx {
  fromCode: string
  toCode: string
  rate: number
}

/**
 * Hook to handle display currency conversion.
 * Centralizes FX rate fetching and caching for consistent behavior across
 * components.
 *
 * Uses synchronous calculation for same-currency cases to prevent
 * "click behind" issues where values show stale rates during React's
 * effect cycle.
 */
export function useDisplayCurrencyConversion({
  sourceCurrency,
  portfolio,
}: UseDisplayCurrencyConversionProps): DisplayCurrencyConversion {
  const holdingState = useHoldingState()
  const displayCurrencyOption = holdingState.displayCurrency
  const mode = displayCurrencyOption.mode
  const customCode = displayCurrencyOption.customCode

  // Currencies are only needed when CUSTOM mode is active. Gating the SWR
  // key on the mode keeps the request off the hot path for non-CUSTOM use.
  // The /api/currencies key is shared with useCurrencies / usePortfolios so
  // SWR collapses concurrent consumers across the tree to one fetch.
  const { data: currenciesData, isLoading: currenciesLoading } = useSWR<{
    data: Currency[]
  }>(
    mode === "CUSTOM" && customCode ? ccyKey : null,
    simpleFetcher(ccyKey),
    SWR_CURRENCIES_CONFIG,
  )
  const currencies = currenciesData?.data

  const [asyncFx, setAsyncFx] = useState<AsyncFx | null>(null)

  const customCurrency =
    mode === "CUSTOM" && customCode && currencies
      ? (currencies.find((c) => c.code === customCode) ?? null)
      : null

  // Determine target currency synchronously for non-CUSTOM modes.
  let targetCurrency: Currency | null
  if (mode === "TRADE") {
    targetCurrency = sourceCurrency || null
  } else if (mode === "PORTFOLIO") {
    targetCurrency = portfolio.currency
  } else if (mode === "BASE") {
    targetCurrency = portfolio.base
  } else if (mode === "CUSTOM" && customCode) {
    targetCurrency = customCurrency
  } else {
    targetCurrency = sourceCurrency || null
  }

  // Sync FX path: same currency or unresolvable target → rate of 1.
  // Different currencies → null, signalling that an async fetch is needed.
  let syncFxRate: number | null
  if (!sourceCurrency || !targetCurrency) {
    syncFxRate = 1
  } else if (sourceCurrency.code === targetCurrency.code) {
    syncFxRate = 1
  } else {
    syncFxRate = null
  }

  // Fetch FX rate only when sync path can't satisfy the request.
  useEffect(() => {
    if (syncFxRate !== null) return () => {}
    if (!sourceCurrency || !targetCurrency) return () => {}
    const fromCode = sourceCurrency.code
    const toCode = targetCurrency.code
    if (asyncFx?.fromCode === fromCode && asyncFx?.toCode === toCode) {
      return () => {}
    }
    let cancelled = false
    fetchFxRate(fromCode, toCode).then((rate) => {
      if (cancelled) return
      setAsyncFx({ fromCode, toCode, rate })
    })
    return () => {
      cancelled = true
    }
  }, [syncFxRate, sourceCurrency, targetCurrency, asyncFx])

  // Resolved FX rate: prefer the synchronous answer; otherwise use the
  // async result iff it matches the currently-requested pair, else 1 while
  // the fetch is in flight (preserves existing "no flicker to wrong rate"
  // semantics).
  let fxRate: number
  if (syncFxRate !== null) {
    fxRate = syncFxRate
  } else if (
    sourceCurrency &&
    targetCurrency &&
    asyncFx?.fromCode === sourceCurrency.code &&
    asyncFx?.toCode === targetCurrency.code
  ) {
    fxRate = asyncFx.rate
  } else {
    fxRate = 1
  }

  // Loading is derived: pending iff we expect an async result we don't yet
  // have. No setIsLoading(true) / setIsLoading(false) inside an effect.
  //
  // CUSTOM-mode pending tracks SWR's isLoading rather than !customCurrency
  // so an invalid customCode (one absent from the response) clears loading
  // when the fetch resolves. Otherwise the hook would stay stuck on the
  // first render after the bad code was selected (downstream falls back to
  // sourceCurrency at rate 1 — the right UX for a missing code).
  const customFetchPending =
    mode === "CUSTOM" && !!customCode && currenciesLoading
  const fxFetchPending =
    syncFxRate === null &&
    !!sourceCurrency &&
    !!targetCurrency &&
    !(
      asyncFx?.fromCode === sourceCurrency.code &&
      asyncFx?.toCode === targetCurrency.code
    )
  const isLoading = customFetchPending || fxFetchPending

  const convert = (value: number): number => value * fxRate

  const currencySymbol = targetCurrency?.symbol || sourceCurrency?.symbol || "$"
  const currencyCode = targetCurrency?.code || sourceCurrency?.code || ""
  const isCustomCurrency = mode === "CUSTOM"

  return {
    convert,
    currencySymbol,
    currencyCode,
    isCustomCurrency,
    isLoading,
  }
}

/**
 * Get the currency list. SWR-backed so consumers share a single in-flight
 * request with usePortfolios / useDisplayCurrencyConversion.
 */
export function useCurrencies(): {
  currencies: Currency[]
  isLoading: boolean
} {
  const { data, isLoading } = useSWR<{ data: Currency[] }>(
    ccyKey,
    simpleFetcher(ccyKey),
    SWR_CURRENCIES_CONFIG,
  )
  return {
    currencies: data?.data ?? [],
    isLoading,
  }
}
