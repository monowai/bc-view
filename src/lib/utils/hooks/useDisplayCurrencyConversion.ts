import { useEffect, useState } from "react"
import { Currency, Portfolio, FxResponse } from "types/beancounter"
import { useHoldingState } from "@lib/holdings/holdingState"

// Cache for currencies to avoid repeated fetches
let currenciesCache: Currency[] | null = null
let currenciesFetchPromise: Promise<Currency[]> | null = null

function fetchCurrencies(): Promise<Currency[]> {
  if (currenciesCache) return Promise.resolve(currenciesCache)

  if (!currenciesFetchPromise) {
    currenciesFetchPromise = fetch("/api/currencies")
      .then((res) => res.json())
      .then((data): Currency[] => {
        currenciesCache = data.data || []
        return currenciesCache as Currency[]
      })
      .catch((err): Currency[] => {
        console.error("Failed to fetch currencies:", err)
        currenciesFetchPromise = null
        return []
      })
  }

  return currenciesFetchPromise as Promise<Currency[]>
}

// Cache for FX rates - keyed by "FROM:TO"
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

interface AsyncCustom {
  code: string
  currency: Currency
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

  // Async-fetched currency for CUSTOM mode. We track which code it was
  // fetched for so a stale value doesn't leak when customCode changes.
  const [asyncCustom, setAsyncCustom] = useState<AsyncCustom | null>(null)

  // Async-fetched FX rate keyed by from/to pair, for the same reason.
  const [asyncFx, setAsyncFx] = useState<AsyncFx | null>(null)

  const customCurrency =
    mode === "CUSTOM" && customCode && asyncCustom?.code === customCode
      ? asyncCustom.currency
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

  // Fetch CUSTOM-mode currency only when in that mode and we don't already
  // have a fresh result for the requested code.
  useEffect(() => {
    if (mode !== "CUSTOM" || !customCode) return () => {}
    if (asyncCustom?.code === customCode) return () => {}
    let cancelled = false
    fetchCurrencies().then((currencies) => {
      if (cancelled) return
      const found = currencies.find((c) => c.code === customCode)
      if (found) setAsyncCustom({ code: customCode, currency: found })
    })
    return () => {
      cancelled = true
    }
  }, [mode, customCode, asyncCustom])

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
  const customFetchPending =
    mode === "CUSTOM" &&
    !!customCode &&
    asyncCustom?.code !== customCode
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
 * Get cached currencies list (for use in components that just need the list)
 */
export function useCurrencies(): {
  currencies: Currency[]
  isLoading: boolean
} {
  // Lazy initial state: if the module cache is already populated we expose
  // it immediately and skip the effect entirely. The "no cache yet" path
  // initialises with [] + isLoading=true and is filled by the effect's
  // async .then() callback.
  const initial = useState<{
    currencies: Currency[]
    isLoading: boolean
  }>(() =>
    currenciesCache
      ? { currencies: currenciesCache, isLoading: false }
      : { currencies: [], isLoading: true },
  )[0]
  const [state, setState] = useState(initial)

  useEffect(() => {
    if (currenciesCache) return () => {}
    let cancelled = false
    fetchCurrencies()
      .then((currencies) => {
        if (cancelled) return
        setState({ currencies, isLoading: false })
      })
      .catch(() => {
        if (cancelled) return
        setState({ currencies: [], isLoading: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
