import { useMemo, useCallback } from "react"
import useSwr from "swr"
import { Portfolio, Currency } from "types/beancounter"
import { ccyKey, portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
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

  // Shared SWR key with useCurrencies / useDisplayCurrencyConversion so all
  // consumers in a render tree collapse to one /api/currencies fetch.
  const { data: currenciesPayload } = useSwr<{ data: Currency[] }>(
    ccyKey,
    simpleFetcher(ccyKey),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  )
  const currencies = currenciesPayload?.data ?? []

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
      const response = await fetch(`/api/portfolios/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData?.message ||
            errorData?.error ||
            "Failed to delete portfolio",
        )
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
