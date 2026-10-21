/**
 * Browser-side calls for holdings, valuations and performance
 * (`/api/holdings/...`, `/api/performance/...`, `/api/net-worth`;
 * svc-position).
 *
 * Keys double as SWR cache keys: keep them byte-identical, since
 * `mutate(key)` elsewhere relies on the exact string. Request functions
 * return the raw `Response`, so each caller keeps its own error wording.
 */
import { jsonInit } from "@utils/api/client/request"

const holdingsBase = "/api/holdings"
const performanceBase = "/api/performance"

export const holdingKey = (portfolioCode: string, asAt: string): string =>
  `${holdingsBase}/${portfolioCode}?asAt=${asAt}`
export const holdingByIdKey = (portfolioId: string, asAt: string): string =>
  `${holdingsBase}/id/${portfolioId}?asAt=${asAt}`

/** Today's aggregated holdings across every portfolio: the shared cache key. */
export const aggregatedHoldingsTodayKey = `${holdingsBase}/aggregated?asAt=today`
/** Today's aggregated holdings, optionally limited to portfolio codes. */
export const aggregatedHoldingsCodesKey = (codes?: string): string =>
  codes
    ? `${aggregatedHoldingsTodayKey}&codes=${encodeURIComponent(codes)}`
    : aggregatedHoldingsTodayKey
export const aggregatedHoldingsQueryUrl = (
  params: URLSearchParams | string,
): string => `${holdingsBase}/aggregated?${params}`
/** Asset-class allocation for today, by comma-joined portfolio ids. */
export const holdingsAllocationUrl = (idsCsv: string): string =>
  `${holdingsBase}/allocation?asAt=today&ids=${encodeURIComponent(idsCsv)}`
export const brokerHoldingsKey = (brokerId: string): string =>
  `${holdingsBase}/broker/${brokerId}?value=false`

export const performanceKey = (portfolioCode: string, months: number): string =>
  `${performanceBase}/${portfolioCode}?months=${months}`
export const benchmarkPerformanceKey = (
  portfolioCode: string,
  indexAssetId: string,
  months: number,
): string =>
  `${performanceBase}/${portfolioCode}/benchmark?indexAssetId=${encodeURIComponent(
    indexAssetId,
  )}&months=${months}`

export const netWorthUrl = (params: URLSearchParams | string): string =>
  `/api/net-worth?${params}`

/** Drop a portfolio's cached performance series so it is rebuilt. */
export function resetPerformanceCache(
  portfolioCode: string,
): Promise<Response> {
  return fetch(`${performanceBase}/${portfolioCode}/reset`, {
    method: "DELETE",
  })
}

export function aggregatePerformance(request: unknown): Promise<Response> {
  return fetch(`${performanceBase}/aggregate`, jsonInit("POST", request))
}
