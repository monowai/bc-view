/**
 * Browser-side calls to the classifications API (`/api/classifications/...`,
 * svc-data): sectors and per-asset exposures.
 *
 * Keys double as SWR cache keys: keep them byte-identical. Request functions
 * return the raw `Response`, so each caller keeps its own error wording.
 */
import { jsonInit } from "@utils/api/client/request"

const base = "/api/classifications"

export const sectorsKey = `${base}/sectors`
export const assetClassificationKey = (assetId: string): string =>
  `${base}/${assetId}`
export const assetExposuresKey = (assetId: string): string =>
  `${assetClassificationKey(assetId)}/exposures`
export const assetHoldingsClassificationKey = (assetId: string): string =>
  `${assetClassificationKey(assetId)}/holdings`

export function getSectors(): Promise<Response> {
  return fetch(sectorsKey)
}

export function getAssetClassification(assetId: string): Promise<Response> {
  return fetch(assetClassificationKey(assetId))
}

export function getAssetExposures(assetId: string): Promise<Response> {
  return fetch(assetExposuresKey(assetId))
}

export function setAssetSector(
  assetId: string,
  sector: string,
): Promise<Response> {
  return fetch(assetClassificationKey(assetId), jsonInit("PUT", { sector }))
}

export function refreshAssetClassification(assetId: string): Promise<Response> {
  return fetch(`${assetClassificationKey(assetId)}/refresh`, {
    method: "POST",
  })
}

export function deleteSector(sectorCode: string): Promise<Response> {
  return fetch(`${sectorsKey}/${encodeURIComponent(sectorCode)}`, {
    method: "DELETE",
  })
}
