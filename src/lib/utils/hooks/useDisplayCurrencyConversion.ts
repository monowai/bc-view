import { useState, useEffect, useCallback, useMemo } from "react"
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

/**

* Hook to handle display currency conversion.
* Centralizes FX rate fetching and caching for consistent behavior across components.
*
* Uses synchronous calculation for same-currency cases to prevent "click behind" issues
* where values show stale rates during React's effect cycle.
 */
export function useDisplayCurrencyConversion({
  sourceCurrency,
  portfolio,
}: UseDisplayCurrencyConversionProps): DisplayCurrencyConversion {
  const holdingState = useHoldingState()
  const displayCurrencyOption = holdingState.displayCurrency

  // State for async operations (CUSTOM mode currency lookup, FX rate fetch)
  const [customCurrency, setCustomCurrency] = useState<Currency | null>(null)
  const [asyncFxRate, setAsyncFxRate] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(false)

  // Determine target currency synchronously for non-CUSTOM modes
  // This prevents "click behind" issues where useEffect runs after render
  const targetCurrency = useMemo((): Currency | null => {
    const { mode, customCode } = displayCurrencyOption

    if (mode === "TRADE") {
      return sourceCurrency || null
    } else if (mode === "PORTFOLIO") {
      return portfolio.currency
    } else if (mode === "BASE") {
      return portfolio.base
    } else if (mode === "CUSTOM" && customCode) {
      // For CUSTOM, we need to use the async-fetched currency
      return customCurrency
    }
    return sourceCurrency || null
  }, [displayCurrencyOption, sourceCurrency, portfolio, customCurrency])

  // Only fetch custom currency when needed (CUSTOM mode)
  useEffect(() => {
    const { mode, customCode } = displayCurrencyOption

    if (mode !== "CUSTOM" || !customCode) {
      setCustomCurrency(null)
      return
    }

    setIsLoading(true)
    fetchCurrencies()
      .then((currencies) => {
        const found = currencies.find((c) => c.code === customCode)
        if (found) setCustomCurrency(found)
      })
      .finally(() => setIsLoading(false))
  }, [displayCurrencyOption])

  // Compute FX rate synchronously when possible (same currency = 1)
  // Only fetch async when currencies differ
  const syncFxRate = useMemo((): number | null => {
    if (!sourceCurrency || !targetCurrency) return 1
    if (sourceCurrency.code === targetCurrency.code) return 1
    return null // Need async fetch
  }, [sourceCurrency, targetCurrency])

  // Fetch FX rate only when currencies differ
  useEffect(() => {
    // If sync rate is available, no async fetch needed
    if (syncFxRate !== null) {
      setAsyncFxRate(1)
      return
    }

    if (!sourceCurrency || !targetCurrency) return

    setIsLoading(true)
    fetchFxRate(sourceCurrency.code, targetCurrency.code)
      .then(setAsyncFxRate)
      .finally(() => setIsLoading(false))
  }, [syncFxRate, sourceCurrency, targetCurrency])

  // Use sync rate if available, otherwise async rate
  const fxRate = syncFxRate ?? asyncFxRate

  const convert = useCallback((value: number) => value * fxRate, [fxRate])

  const currencySymbol = targetCurrency?.symbol || sourceCurrency?.symbol || "$"
  const currencyCode = targetCurrency?.code || sourceCurrency?.code || ""
  const isCustomCurrency = displayCurrencyOption.mode === "CUSTOM"

  return useMemo(
    () => ({
      convert,
      currencySymbol,
      currencyCode,
      isCustomCurrency,
      isLoading,
    }),
    [convert, currencySymbol, currencyCode, isCustomCurrency, isLoading],
  )
}

/**

* Get cached currencies list (for use in components that just need the list)
 */
export function useCurrencies(): {
  currencies: Currency[]
  isLoading: boolean
} {
  const [currencies, setCurrencies] = useState<Currency[]>(
    currenciesCache || [],
  )
  const [isLoading, setIsLoading] = useState(!currenciesCache)

  useEffect(() => {
    if (currenciesCache) {
      setCurrencies(currenciesCache)
      return
    }

    setIsLoading(true)
    fetchCurrencies()
      .then(setCurrencies)
      .finally(() => setIsLoading(false))
  }, [])

  return { currencies, isLoading }
}
