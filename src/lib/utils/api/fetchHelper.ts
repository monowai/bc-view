import { NextApiRequest } from "next"

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
const apiRoot = "/api"
export const ccyKey = `${apiRoot}/currencies`
export const marketsKey = `${apiRoot}/markets`
export const categoriesKey = `${apiRoot}/categories`

export const portfoliosKey = `${apiRoot}/portfolios`
export const assetsKey = `${apiRoot}/assets`
export const accountsKey = `${assetsKey}?category=ACCOUNT`
export const tradeAccountsKey = `${assetsKey}?category=TRADE`

export const trnsKey = `${apiRoot}/trns`
export const assetKey = (assetId: string): string =>
  `${apiRoot}/assets/${assetId}`
export const tradeKey = (portfolioId: string, assetId: string): string =>
  `${trnsKey}/trades/${portfolioId}/${assetId}`
export const eventKey = (portfolioId: string, assetId: string): string =>
  `${trnsKey}/events/${portfolioId}/${assetId}`

export const holdingKey = (portfolioCode: string, asAt: string): string =>
  `${apiRoot}/holdings/${portfolioCode}?asAt=${asAt}`

export const portfolioKey = (portfolioId: string): string =>
  `${portfoliosKey}/${portfolioId}`

export const trnKey = (trnId: string): string => `${trnsKey}/${trnId}`

export const corporateEventsKey = (
  assetId: string,
  fromDate?: string,
  toDate?: string,
): string => {
  const base = `${apiRoot}/corporate-events/${assetId}`
  if (fromDate && toDate) {
    return `${base}?fromDate=${fromDate}&toDate=${toDate}`
  }
  return base
}
