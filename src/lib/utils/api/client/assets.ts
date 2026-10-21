/**
 * Browser-side calls to the assets API (`/api/assets/...`, svc-data).
 *
 * Keys are SWR cache keys as well as URLs: keep them byte-identical, since
 * `mutate(key)` elsewhere relies on the exact string. Request functions own
 * the URL, method, headers and body and return the raw `Response`, so each
 * caller keeps its own error wording.
 */
import { jsonInit } from "@utils/api/client/request"

export const assetsKey = "/api/assets"
export const accountsKey = `${assetsKey}?category=ACCOUNT`
export const tradeAccountsKey = `${assetsKey}?category=TRADE`
export const assetKey = (assetId: string): string => `${assetsKey}/${assetId}`

export const assetConfigsKey = `${assetsKey}/config`
export const assetsExportUrl = `${assetsKey}/export`
const assetsImportUrl = `${assetsKey}/import`

export const assetConfigKey = (assetId: string): string =>
  `${assetConfigsKey}/${assetId}`

export const assetPositionsKey = (assetId: string): string =>
  `${assetsKey}/${assetId}/positions?date=today`

export const assetBrokersKey = (assetId: string): string =>
  `${assetsKey}/${assetId}/brokers`

export const assetValuesKey = (currency?: string): string =>
  currency
    ? `${assetsKey}/values?currency=${encodeURIComponent(currency)}`
    : `${assetsKey}/values`

export const marketAssetsKey = (market: string): string =>
  `${assetsKey}/market/${market}`

/** `/api/assets/resolve?<query>`; the caller builds (and encodes) the query. */
export const assetResolveKey = (query: string): string =>
  `${assetsKey}/resolve?${query}`

export const assetSearchUrl = (params: URLSearchParams | string): string =>
  `${assetsKey}/search?${params}`

const assetAdminUrl = (assetId: string): string =>
  `${assetsKey}/admin/${assetId}`

export function getAsset(assetId: string): Promise<Response> {
  return fetch(assetKey(assetId))
}

/** POST `{ data: { [code]: AssetInput } }`: creates or finds each asset. */
export function createAssets(request: unknown): Promise<Response> {
  return fetch(assetsKey, jsonInit("POST", request))
}

export function updateAsset(assetId: string, body: unknown): Promise<Response> {
  return fetch(assetKey(assetId), jsonInit("PATCH", body))
}

export function deleteAsset(assetId: string): Promise<Response> {
  return fetch(assetKey(assetId), { method: "DELETE" })
}

export function updateAssetStatus(
  assetId: string,
  status: string,
): Promise<Response> {
  return fetch(`${assetKey(assetId)}/status`, jsonInit("PATCH", { status }))
}

export function enrichAsset(assetId: string): Promise<Response> {
  return fetch(`${assetKey(assetId)}/enrich`, { method: "POST" })
}

export function updateAssetAdmin(
  assetId: string,
  body: unknown,
): Promise<Response> {
  return fetch(assetAdminUrl(assetId), jsonInit("PATCH", body))
}

export function deleteAssetAdmin(assetId: string): Promise<Response> {
  return fetch(assetAdminUrl(encodeURIComponent(assetId)), {
    method: "DELETE",
  })
}

export function getAssetConfig(assetId: string): Promise<Response> {
  return fetch(assetConfigKey(assetId))
}

export function saveAssetConfig(
  assetId: string,
  config: unknown,
): Promise<Response> {
  return fetch(assetConfigKey(assetId), jsonInit("POST", config))
}

export function deleteAssetConfig(assetId: string): Promise<Response> {
  return fetch(assetConfigKey(assetId), { method: "DELETE" })
}

export function getAssetPositions(assetId: string): Promise<Response> {
  return fetch(assetPositionsKey(assetId))
}

export function importAssets(csvContent: string): Promise<Response> {
  return fetch(assetsImportUrl, jsonInit("POST", { csvContent }))
}

export function searchAssets(
  params: URLSearchParams | string,
): Promise<Response> {
  return fetch(assetSearchUrl(params))
}

export function resolveAsset(query: string): Promise<Response> {
  return fetch(assetResolveKey(query))
}

/** The id of the generic CASH asset for a currency (e.g. CASH/USD). */
export async function resolveCashAssetId(
  currencyCode: string,
): Promise<string> {
  const response = await resolveAsset(`market=CASH&code=${currencyCode}`)
  if (!response.ok) {
    throw new Error(`Failed to resolve cash asset: ${currencyCode}`)
  }
  const data = await response.json()
  return data.data.id
}
