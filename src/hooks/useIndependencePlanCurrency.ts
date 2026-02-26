import { useState, useEffect } from "react"
import { FxResponse } from "types/beancounter"

export interface UseIndependencePlanCurrencyResult {
  displayCurrency: string | null
  setDisplayCurrency: (currency: string | null) => void
  fxRate: number
  fxRateLoaded: boolean
  effectiveCurrency: string
  effectiveFxRate: number
}

export function useIndependencePlanCurrency(
  planCurrency: string,
): UseIndependencePlanCurrencyResult {
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(null)
  const [fxRate, setFxRate] = useState<number>(1)
  const [fxRateLoaded, setFxRateLoaded] = useState<boolean>(true)

  // Only use display currency when fxRate has been loaded to avoid showing wrong values
  const effectiveCurrency =
    displayCurrency && fxRateLoaded ? displayCurrency : planCurrency
  // For plan values that need frontend FX conversion
  const effectiveFxRate =
    displayCurrency && fxRateLoaded && displayCurrency !== planCurrency
      ? fxRate
      : 1

  // Fetch FX rate when display currency changes
  useEffect(() => {
    const fetchFxRate = async (): Promise<void> => {
      if (!displayCurrency || displayCurrency === planCurrency) {
        setFxRate(1)
        setFxRateLoaded(true)
        return
      }
      // Mark as loading while fetching
      setFxRateLoaded(false)
      try {
        const response = await fetch("/api/fx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rateDate: "today",
            pairs: [{ from: planCurrency, to: displayCurrency }],
          }),
        })
        const fxResponse: FxResponse = await response.json()
        const rateKey = `${planCurrency}:${displayCurrency}`
        const rate = fxResponse.data?.rates?.[rateKey]?.rate
        if (rate && rate !== 1) {
          setFxRate(rate)
          setFxRateLoaded(true)
        } else {
          // Rate not found or is 1 - stay in plan currency
          console.warn(`FX rate not found for ${rateKey}, using plan currency`)
          setFxRate(1)
          setFxRateLoaded(false)
        }
      } catch (err) {
        console.error("Failed to fetch FX rate:", err)
        setFxRate(1)
        setFxRateLoaded(false)
      }
    }
    fetchFxRate()
  }, [planCurrency, displayCurrency])

  return {
    displayCurrency,
    setDisplayCurrency,
    fxRate,
    fxRateLoaded,
    effectiveCurrency,
    effectiveFxRate,
  }
}
