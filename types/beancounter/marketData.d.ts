import type { TrnType } from "./trn"

// svc-data GET /news article. `source` is the article URL (EODHD) or the
// publisher name (AlphaVantage).
export interface NewsArticle {
  title: string
  summary: string
  source: string
  timePublished: string
  sentimentLabel: string
  sentimentScore: number
}

// svc-data GET /news body — an empty object when the provider has no coverage.
export interface NewsResponse {
  feed?: NewsArticle[]
  count?: number
}

export interface PriceData {
  change: number
  close: number
  previousClose: number
  changePercent: number
  priceDate: string
}

export interface CorporateEvent {
  id: string
  trnType: TrnType
  source: string
  assetId: string
  recordDate: string
  rate: number
  split: number
  payDate: string
}

export interface CorporateEventResponse {
  data: CorporateEvent
}

export interface CorporateEventsResponse {
  data: CorporateEvent[]
}
