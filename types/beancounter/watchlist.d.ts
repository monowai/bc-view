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
  /** yyyy-MM-dd close on which the target was last hit; null when not hit. */
  targetHitOn: string | null
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

/** ABOVE: the close rose to the target. BELOW: it fell to it. */
export type WatchlistAlertDirection = "ABOVE" | "BELOW"

/** svc-data /watchlist/alerts — a target hit awaiting dismissal. Render as given. */
export interface WatchlistAlert {
  id: string
  itemId: string
  asset: Asset
  currency: Currency
  targetPrice: number
  direction: WatchlistAlertDirection
  /** The close that hit the target. */
  close: number
  /** yyyy-MM-dd */
  priceDate: string
  /** ISO instant */
  createdAt: string
}
