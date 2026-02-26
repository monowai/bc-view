import { useState, useEffect, useMemo, useCallback } from "react"
import useSwr from "swr"
import { Portfolio, Currency } from "types/beancounter"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { useFxRates } from "./useFxRates"

interface UsePortfoliosResult {
  portfolios: Portfolio[]
  currencies: Currency[]
  displayCurrency: Currency | null
  setDisplayCurrency: (currency: Currency) => void
  fxRates: Record<string, number>
  fxRatesReady: boolean
  error: Error | undefined
  isLoading: boolean
  mutate: () => Promise<unknown>
  deletePortfolio: (id: string) => Promise<void>
}

export function usePortfolios(): UsePortfoliosResult {
  const { data, mutate, error } = useSwr(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )

  const [currencies, setCurrencies] = useState<Currency[]>([])

  useEffect(() => {
    fetch("/api/currencies")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setCurrencies(data.data)
        }
      })
      .catch(console.error)
  }, [])

  const sourceCurrencyCodes = useMemo(
    () => (data?.data || []).map((p: Portfolio) => p.base.code),
    [data?.data],
  )

  const {
    displayCurrency,
    setDisplayCurrency,
    fxRates,
    fxReady: fxRatesReady,
  } = useFxRates(currencies, sourceCurrencyCodes)

  const deletePortfolio = useCallback(
    async (id: string): Promise<void> => {
      const response = await fetch(`/api/portfolios/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData?.message || errorData?.error || "Failed to delete portfolio")
      }
      await mutate()
    },
    [mutate],
  )

  return {
    portfolios: data?.data || [],
    currencies,
    displayCurrency,
    setDisplayCurrency,
    fxRates,
    fxRatesReady,
    error,
    isLoading: !data && !error,
    mutate,
    deletePortfolio,
  }
}
