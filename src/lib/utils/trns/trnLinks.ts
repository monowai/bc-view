/**
 * Links between a trade and the cash it settled to. Each lands on a list with
 * one transaction flashed: the `#trn-<id>` fragment names it, and
 * `useTrnHighlight` scrolls to and flashes the row carrying `data-trn-id`.
 */

import { buildTradesHref } from "@lib/assets/assetUtils"

const TRN_FRAGMENT = "#trn-"

const fragment = (trnId: string): string =>
  `${TRN_FRAGMENT}${encodeURIComponent(trnId)}`

/** A portfolio's cash ladder for one cash account, with a transaction flashed. */
export const cashLadderHref = (
  portfolioId: string,
  cashAssetId: string,
  trnId: string,
): string => `/trns/cash-ladder/${portfolioId}/${cashAssetId}${fragment(trnId)}`

/** A position's trades, with a transaction flashed. */
export const tradesHighlightHref = (
  portfolioId: string,
  assetId: string,
  trnId: string,
): string => `${buildTradesHref(portfolioId, assetId)}${fragment(trnId)}`

/** The transaction a URL fragment names, if it names one. */
export const highlightedTrnId = (hash: string): string | undefined =>
  hash.startsWith(TRN_FRAGMENT)
    ? decodeURIComponent(hash.slice(TRN_FRAGMENT.length)) || undefined
    : undefined
