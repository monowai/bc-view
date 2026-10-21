/**
 * Browser-side calls to the portfolios API (`/api/portfolios/...`, svc-data).
 *
 * Keys double as SWR cache keys: keep them byte-identical. Request functions
 * return the raw `Response`, so each caller keeps its own error wording.
 */
import { jsonInit } from "@utils/api/client/request"

/** Active portfolios only. */
export const activePortfoliosKey = "/api/portfolios"
/** Active and inactive portfolios. */
export const portfoliosKey = `${activePortfoliosKey}?inactive=true`
export const portfolioKey = (portfolioId: string): string =>
  `${activePortfoliosKey}/${portfolioId}`
export const portfoliosExportUrl = `${activePortfoliosKey}/export`

export function createPortfolios(request: unknown): Promise<Response> {
  return fetch(activePortfoliosKey, jsonInit("POST", request))
}

export function deletePortfolio(portfolioId: string): Promise<Response> {
  return fetch(portfolioKey(portfolioId), { method: "DELETE" })
}

/** Move every holding of `sourceId` into `targetId`. */
export function mergePortfolios(
  sourceId: string,
  targetId: string,
): Promise<Response> {
  return fetch(`${portfolioKey(sourceId)}/merge/${targetId}`, jsonInit("POST"))
}

export function importPortfolios(csvContent: string): Promise<Response> {
  return fetch(
    `${activePortfoliosKey}/import`,
    jsonInit("POST", { csvContent }),
  )
}
