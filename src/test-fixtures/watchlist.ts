import { Watchlist, WatchlistItem } from "types/beancounter"
import { USD, makeAsset } from "./asset"

export function makeWatchlistItem(
  overrides: Partial<WatchlistItem> = {},
): WatchlistItem {
  return {
    id: "wi-1",
    asset: makeAsset(),
    addedPrice: 100,
    addedOn: "2026-01-02",
    targetPrice: 150,
    currency: USD,
    price: 120,
    priceDate: "2026-01-09",
    changeOnDay: 2,
    changeOnDayPercent: 0.0169,
    changeSinceAdded: 20,
    changeSinceAddedPercent: 0.2,
    toTarget: 0.25,
    ...overrides,
  }
}

export function makeWatchlist(overrides: Partial<Watchlist> = {}): Watchlist {
  return {
    items: [makeWatchlistItem()],
    ...overrides,
  }
}
