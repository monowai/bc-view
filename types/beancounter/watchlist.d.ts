import type { Asset, Currency } from "./asset"

// svc-data /watchlist — one per user. Every change / percent field is
// computed server side and is a FRACTION (0.25 = 25%). Render as given; null
// means unknown.
export interface WatchlistItem {
  id: string
  asset: Asset
  addedPrice: number
  /** yyyy-MM-dd */
  addedOn: string
  targetPrice: number | null
  currency: Currency
  price: number | null
  priceDate: string | null
  changeOnDay: number | null
  changeOnDayPercent: number | null
  changeSinceAdded: number | null
  changeSinceAddedPercent: number | null
  /** (target − price) / price */
  toTarget: number | null
}

export interface Watchlist {
  items: WatchlistItem[]
}

/** Omit addedPrice to have the server stamp the latest close. */
export interface WatchlistItemRequest {
  assetId: string
  addedPrice?: number
  targetPrice?: number
}

/** Absent = unchanged. clearTarget and targetPrice are mutually exclusive. */
export interface WatchlistItemUpdate {
  addedPrice?: number
  targetPrice?: number
  clearTarget?: boolean
}
