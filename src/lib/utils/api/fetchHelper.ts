import { NextApiRequest } from "next"
import { readServerMessage } from "@utils/api/client/request"

/**
 * Create request init for backend API calls.
 * Forwards sentry-trace and baggage headers for distributed tracing.
 */
export function requestInit(
  accessToken: string | undefined,
  method: string = "GET",
  req?: NextApiRequest,
): RequestInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  }

  // Forward trace headers for distributed tracing
  if (req) {
    const sentryTrace = req.headers["sentry-trace"]
    const baggage = req.headers["baggage"]
    if (sentryTrace) {
      headers["sentry-trace"] = Array.isArray(sentryTrace)
        ? sentryTrace[0]
        : sentryTrace
    }
    if (baggage) {
      headers["baggage"] = Array.isArray(baggage) ? baggage[0] : baggage
    }
  }

  return {
    method,
    headers,
  }
}

export function simpleFetcher(requestInfo: RequestInfo): any {
  return async () => {
    const res = await fetch(requestInfo)
    if (!res.ok) {
      throw await res.json()
    }
    return res.json()
  }
}

/**
 * Fetcher that returns undefined on error instead of throwing
 * Use for optional endpoints that may not exist
 */
export function optionalFetcher(requestInfo: RequestInfo): any {
  return async () => {
    try {
      const res = await fetch(requestInfo)
      if (!res.ok) {
        return undefined
      }
      return res.json()
    } catch {
      return undefined
    }
  }
}

/**
 * Standard SWR fetcher - receives URL from useSwr key
 */
export const fetcher = async (url: string): Promise<any> => {
  const res = await fetch(url)
  if (!res.ok) {
    throw await res.json()
  }
  return res.json()
}
const apiRoot = "/api"
// Asset keys live with the rest of the assets API; re-exported for older importers.
export {
  accountsKey,
  assetKey,
  assetsKey,
  tradeAccountsKey,
} from "@utils/api/client/assets"
export const ccyKey = `${apiRoot}/currencies`
export const marketsKey = `${apiRoot}/markets`
export const categoriesKey = `${apiRoot}/categories`

export { portfolioKey, portfoliosKey } from "@utils/api/client/portfolios"
export const cashKey = `${apiRoot}/cash`

export {
  eventKey,
  tradeKey,
  tradeKeyMulti,
  trnKey,
  trnsKey,
} from "@utils/api/client/trns"

export const newsKey = (symbol: string, market?: string): string => {
  const params = new URLSearchParams({ tickers: symbol })
  if (market) params.append("market", market)
  return `${apiRoot}/news?${params.toString()}`
}

export { holdingByIdKey, holdingKey } from "@utils/api/client/holdings"

export { corporateEventsKey } from "@utils/api/client/corporateEvents"

// Rebalance API keys
export {
  executionKey,
  executionsKey,
  modelKey,
  modelsKey,
} from "@utils/api/client/rebalance"

// Watchlist (svc-data) — one per user
export const watchlistKey = `${apiRoot}/watchlist`

// API keys (BC-issued, for external agent/MCP access)
export const apiKeysKey = `${apiRoot}/me/api-keys`

// Shares API keys
export {
  resourceSharesManagedKey,
  resourceSharesPendingKey,
  sharesManagedKey,
  sharesPendingKey,
} from "@utils/api/client/shares"

/**
 * POST a JSON body and return the parsed response as T.
 * Throws an Error (with the server's message when available) on non-2xx.
 */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(
      (await readServerMessage(res)) ||
        `${url} failed (${res.status} ${res.statusText})`,
    )
  }
  return (await res.json()) as T
}

/**
 * PATCH a JSON body and return the parsed response as T.
 * Throws an Error (with the server's message when available) on non-2xx.
 */
export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(
      (await readServerMessage(res)) ||
        `${url} failed (${res.status} ${res.statusText})`,
    )
  }
  return (await res.json()) as T
}
