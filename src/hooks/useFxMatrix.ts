import { useMemo } from "react"
import useSwr from "swr"
import {
  Currency,
  FxProvidersResponse,
  FxRequest,
  FxResponse,
} from "types/beancounter"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"

const fxFetcher = async (
  url: string,
  pairs: Array<{ from: string; to: string }>,
  provider?: string,
): Promise<FxResponse> => {
  const body: FxRequest = { pairs }
  if (provider) {
    body.provider = provider
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch FX rates: ${response.status}`)
  }
  return response.json()
}

interface RateDates {
  rateDate: string
  rateDate1: string
  rateDate2: string
}

interface UseFxMatrixResult {
  currencies: Currency[]
  rates: Record<string, { rate: number; date: string }>
  compareRates1: Record<string, { rate: number; date: string }>
  compareRates2: Record<string, { rate: number; date: string }>
  providers: string[]
  isLoading: boolean
  error: Error | undefined
  rateDates: RateDates
}

export function useFxMatrix(
  selectedProvider: string | undefined,
  compareMode: boolean,
): UseFxMatrixResult {
  const ccyResponse = useSwr<{ data: Currency[] }>(
    ccyKey,
    simpleFetcher(ccyKey),
  )

  const providersResponse = useSwr<FxProvidersResponse>(
    "/api/fx/providers",
    simpleFetcher("/api/fx/providers"),
  )

  const currencyPairs = useMemo(() => {
    if (!ccyResponse.data?.data) return []
    const currencies = ccyResponse.data.data
    const pairs: Array<{ from: string; to: string }> = []
    for (const from of currencies) {
      for (const to of currencies) {
        if (from.code !== to.code) {
          pairs.push({ from: from.code, to: to.code })
        }
      }
    }
    return pairs
  }, [ccyResponse.data?.data])

  const fxKey =
    currencyPairs.length > 0
      ? ["/api/fx", currencyPairs, selectedProvider]
      : null
  const fxResponse = useSwr<FxResponse>(
    fxKey,
    ([url, pairs]: [string, Array<{ from: string; to: string }>, string?]) =>
      fxFetcher(url, pairs, selectedProvider),
  )

  const providers = providersResponse.data?.providers || []
  const provider1 = providers[0]
  const provider2 = providers[1]

  const fxResponse1 = useSwr<FxResponse>(
    compareMode && currencyPairs.length > 0 && provider1
      ? ["/api/fx", currencyPairs, provider1, "p1"]
      : null,
    ([url, pairs]: [
      string,
      Array<{ from: string; to: string }>,
      string,
      string,
    ]) => fxFetcher(url, pairs, provider1),
  )

  const fxResponse2 = useSwr<FxResponse>(
    compareMode && currencyPairs.length > 0 && provider2
      ? ["/api/fx", currencyPairs, provider2, "p2"]
      : null,
    ([url, pairs]: [
      string,
      Array<{ from: string; to: string }>,
      string,
      string,
    ]) => fxFetcher(url, pairs, provider2),
  )

  const currencies = ccyResponse.data?.data || []
  const rates = fxResponse.data?.data?.rates || {}
  const compareRates1 = fxResponse1.data?.data?.rates || {}
  const compareRates2 = fxResponse2.data?.data?.rates || {}

  const rateDate = Object.values(rates)[0]?.date || ""
  const rateDate1 = Object.values(compareRates1)[0]?.date || ""
  const rateDate2 = Object.values(compareRates2)[0]?.date || ""

  const isLoading =
    ccyResponse.isLoading ||
    providersResponse.isLoading ||
    fxResponse.isLoading ||
    (compareMode && (fxResponse1.isLoading || fxResponse2.isLoading))

  const error =
    ccyResponse.error ||
    providersResponse.error ||
    fxResponse.error ||
    (compareMode ? fxResponse1.error || fxResponse2.error : undefined)

  return {
    currencies,
    rates,
    compareRates1,
    compareRates2,
    providers,
    isLoading,
    error,
    rateDates: { rateDate, rateDate1, rateDate2 },
  }
}
