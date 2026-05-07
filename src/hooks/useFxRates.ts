import { useEffect, useState } from "react"
import { Currency, FxResponse } from "types/beancounter"
import { useUserPreferences } from "@contexts/UserPreferencesContext"

interface UseFxRatesResult {
  displayCurrency: Currency | null
  setDisplayCurrency: (currency: Currency) => void
  fxRates: Record<string, number>
  fxReady: boolean
}

const EMPTY_RATES: Record<string, number> = Object.freeze({})

function uniqueCodes(codes: string[]): string[] {
  return [...new Set(codes)]
}

function fetchKeyFor(
  displayCurrency: Currency,
  uniqueSourceCodes: string[],
): string {
  return `${displayCurrency.code}|${uniqueSourceCodes.join(",")}`
}

/**
 * Manages display currency selection and FX rate fetching.
 *
 * @param currencies - Available currencies (from SWR or manual fetch)
 * @param sourceCurrencyCodes - Base currency codes that need conversion (e.g. portfolio base currencies)
 */
export function useFxRates(
  currencies: Currency[],
  sourceCurrencyCodes: string[],
): UseFxRatesResult {
  const { preferences } = useUserPreferences()

  // Default display currency derived from currencies + user prefs. Compiler
  // memoizes this — no manual useMemo (whose optional-chain dep would bail
  // the compiler from optimizing the rest of the hook).
  const baseCurrencyCode = preferences?.baseCurrencyCode
  const defaultDisplayCurrency = ((): Currency | null => {
    if (currencies.length === 0) return null
    if (baseCurrencyCode) {
      const preferred = currencies.find((c) => c.code === baseCurrencyCode)
      if (preferred) return preferred
    }
    return currencies.find((c) => c.code === "USD") || currencies[0]
  })()

  // User can override the default; null means "follow default".
  const [overrideCurrency, setOverrideCurrency] = useState<Currency | null>(
    null,
  )
  const displayCurrency = overrideCurrency ?? defaultDisplayCurrency

  // Trivial fx rate computation that doesn't require a network call:
  // - no source currencies → empty map
  // - every source currency equals displayCurrency → unit rates for each
  // Returns null when an async fetch is required.
  const trivialRates = ((): Record<string, number> | null => {
    if (!displayCurrency) return null
    if (sourceCurrencyCodes.length === 0) return EMPTY_RATES
    const unique = uniqueCodes(sourceCurrencyCodes)
    const pairs = unique.filter((code) => code !== displayCurrency.code)
    if (pairs.length === 0) {
      const rates: Record<string, number> = {}
      unique.forEach((code) => {
        rates[code] = 1
      })
      return rates
    }
    return null
  })()

  const [asyncRates, setAsyncRates] = useState<Record<string, number>>(
    EMPTY_RATES,
  )
  const [asyncFetchKey, setAsyncFetchKey] = useState<string | null>(null)

  // Async fetch path. Only runs when trivialRates is null.
  useEffect(() => {
    if (!displayCurrency || trivialRates !== null) return () => {}

    const unique = uniqueCodes(sourceCurrencyCodes)
    const pairs = unique
      .filter((code) => code !== displayCurrency.code)
      .map((code) => ({ from: code, to: displayCurrency.code }))

    const expectedKey = fetchKeyFor(displayCurrency, unique)
    let cancelled = false

    fetch("/api/fx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rateDate: "today", pairs }),
    })
      .then((res) => res.json())
      .then((fxResponse: FxResponse) => {
        if (cancelled) return
        const rates: Record<string, number> = {}
        rates[displayCurrency.code] = 1
        Object.entries(fxResponse.data?.rates || {}).forEach(
          ([key, rateData]) => {
            const [from] = key.split(":")
            rates[from] = rateData.rate
          },
        )
        setAsyncRates(rates)
        setAsyncFetchKey(expectedKey)
      })
      .catch(console.error)

    return () => {
      cancelled = true
    }
  }, [displayCurrency, sourceCurrencyCodes, trivialRates])

  const fxRates = trivialRates ?? asyncRates

  // Ready iff trivial OR the async result matches the current request key.
  let fxReady: boolean
  if (!displayCurrency) {
    fxReady = false
  } else if (trivialRates !== null) {
    fxReady = true
  } else {
    const expectedKey = fetchKeyFor(
      displayCurrency,
      uniqueCodes(sourceCurrencyCodes),
    )
    fxReady = asyncFetchKey === expectedKey
  }

  return {
    displayCurrency,
    setDisplayCurrency: setOverrideCurrency,
    fxRates,
    fxReady,
  }
}
