/**
 * Browser-side calls to the prices API (`/api/prices/...`, svc-data).
 *
 * Keys double as SWR cache keys: keep them byte-identical. Request functions
 * return the raw `Response`, so each caller keeps its own error wording.
 */
import { jsonInit } from "@utils/api/client/request"

const pricesBase = "/api/prices"
export const priceHistoryKey = (
  assetId: string,
  from: string,
  to: string,
): string => `${pricesBase}/history/${assetId}?from=${from}&to=${to}`
export const priceQuoteKey = (assetId: string): string =>
  `${pricesBase}/${assetId}/quote`
/** `/api/prices/{market}/{code}`; the caller appends any query string. */
export const marketPriceUrl = (market: string, assetCode: string): string =>
  `${pricesBase}/${market}/${assetCode}`

/** Record a closing price, e.g. a user-set value for a private asset. */
export function writePrice(request: unknown): Promise<Response> {
  return fetch(`${pricesBase}/write`, jsonInit("POST", request))
}

export function repairSplits(assetId: string): Promise<Response> {
  return fetch(`${pricesBase}/${assetId}/repair-splits`, { method: "POST" })
}

export function backfillPrices(portfolioCode: string): Promise<Response> {
  return fetch(`${pricesBase}/backfill/${portfolioCode}`, { method: "POST" })
}
