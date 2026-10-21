/**
 * Browser-side calls to the corporate events API (`/api/corporate-events/...`,
 * svc-event).
 *
 * Keys double as SWR cache keys: keep them byte-identical. Request functions
 * return the raw `Response`, so each caller keeps its own error wording.
 */

const base = "/api/corporate-events"

export const corporateEventsKey = (
  assetId: string,
  fromDate?: string,
  toDate?: string,
): string => {
  const assetEvents = `${base}/${assetId}`
  if (fromDate && toDate) {
    return `${assetEvents}?fromDate=${fromDate}&toDate=${toDate}`
  }
  return assetEvents
}

/** POST target that loads an asset's events as at a date from the provider. */
export const loadCorporateEventsUrl = (assetId: string, asAt: string): string =>
  `${base}/load/asset/${assetId}?asAt=${asAt}`

/** Turn an event into transactions for the holders on its record date. */
export function processCorporateEvent(
  eventId: string,
  payDate?: string,
): Promise<Response> {
  const url = payDate
    ? `${base}/process/${eventId}?payDate=${payDate}`
    : `${base}/process/${eventId}`
  return fetch(url, { method: "POST" })
}
