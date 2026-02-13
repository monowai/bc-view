import { useState, useEffect } from "react"
import { Currency, FxResponse } from "types/beancounter"
import { useUserPreferences } from "@contexts/UserPreferencesContext"

interface UseFxRatesResult {
  displayCurrency: Currency | null
  setDisplayCurrency: (currency: Currency) => void
  fxRates: Record<string, number>
  fxReady: boolean
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
  const [displayCurrency, setDisplayCurrency] = useState<Currency | null>(null)
  const [fxRates, setFxRates] = useState<Record<string, number>>({})
  const [fxReady, setFxReady] = useState(false)

  // Set default display currency from user preferences
  useEffect(() => {
    if (currencies.length === 0 || displayCurrency) return

    if (preferences?.baseCurrencyCode) {
      const preferred = currencies.find(
        (c) => c.code === preferences.baseCurrencyCode,
      )
      if (preferred) {
        setDisplayCurrency(preferred)
        return
      }
    }

    const usd = currencies.find((c) => c.code === "USD")
    setDisplayCurrency(usd || currencies[0])
  }, [currencies, displayCurrency, preferences?.baseCurrencyCode])

  // Fetch FX rates for source currencies → display currency
  useEffect(() => {
    if (!displayCurrency) return

    if (sourceCurrencyCodes.length === 0) {
      setFxRates({})
      setFxReady(true)
      return
    }

    setFxReady(false)

    const uniqueCurrencies = [...new Set(sourceCurrencyCodes)]
    const pairs = uniqueCurrencies
      .filter((code) => code !== displayCurrency.code)
      .map((code) => ({ from: code, to: displayCurrency.code }))

    if (pairs.length === 0) {
      const rates: Record<string, number> = {}
      uniqueCurrencies.forEach((code) => {
        rates[code] = 1
      })
      setFxRates(rates)
      setFxReady(true)
      return
    }

    fetch("/api/fx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rateDate: "today", pairs }),
    })
      .then((res) => res.json())
      .then((fxResponse: FxResponse) => {
        const rates: Record<string, number> = {}
        rates[displayCurrency.code] = 1

        Object.entries(fxResponse.data?.rates || {}).forEach(
          ([key, rateData]) => {
            const [from] = key.split(":")
            rates[from] = rateData.rate
          },
        )
        setFxRates(rates)
        setFxReady(true)
      })
      .catch(console.error)
  }, [displayCurrency, sourceCurrencyCodes])

  return { displayCurrency, setDisplayCurrency, fxRates, fxReady }
}
