import type { Currency } from "./asset"

// FX Rate types
export interface FxRate {
  from: Currency
  to: Currency
  rate: number
  date: string
}

export interface FxPairResults {
  rates: Record<string, FxRate>
}

export interface FxResponse {
  data: FxPairResults
}

export interface FxRequest {
  rateDate?: string
  pairs: Array<{ from: string; to: string }>
  provider?: string // Optional: FRANKFURTER, EXCHANGE_RATES_API, or undefined for composite
}

export interface FxProvidersResponse {
  providers: string[]
}
