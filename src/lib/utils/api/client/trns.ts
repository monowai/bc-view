/**
 * Browser-side calls to the transactions API (`/api/trns/...`, svc-data).
 *
 * Keys double as SWR cache keys: keep them byte-identical, since
 * `mutate(key)` elsewhere relies on the exact string. Request functions own
 * the URL, method, headers and body and return the raw `Response`, so each
 * caller keeps its own error wording.
 */
import { TRN_STATUS } from "types/constants"
import { jsonInit } from "@utils/api/client/request"

export const trnsKey = "/api/trns"
export const trnKey = (trnId: string): string => `${trnsKey}/${trnId}`
export const tradeKey = (portfolioId: string, assetId: string): string =>
  `${trnsKey}/trades/${portfolioId}/${assetId}`
export const tradeKeyMulti = (
  assetId: string,
  portfolioIds: string[],
): string => `${trnsKey}/trades/${assetId}?portfolios=${portfolioIds.join(",")}`
export const eventKey = (portfolioId: string, assetId: string): string =>
  `${trnsKey}/events/${portfolioId}/${assetId}`

const proposedPrefix = `${trnsKey}/proposed`
export const proposedCountKey = `${proposedPrefix}/count`
export const proposedTrnsKey = (scope: string, asAt: string): string =>
  `${proposedPrefix}?scope=${scope}&asAt=${asAt}`
/** True for every `/api/trns/proposed*` SWR key, whatever the scope. */
export const isProposedTrnsKey = (key: unknown): boolean =>
  typeof key === "string" && key.startsWith(proposedPrefix)

export const settledTrnsUrl = (from: string, to: string): string =>
  `${trnsKey}/settled?from=${from}&to=${to}`
export const incomeMonthlyKey = (params: URLSearchParams | string): string =>
  `${trnsKey}/income/monthly?${params}`
export const investmentsMonthlyKey = (currency: string): string =>
  `${trnsKey}/investments/monthly?currency=${currency}&days=30`
export const investmentsMonthlyTransactionsKey = `${trnsKey}/investments/monthly/transactions?days=30`
export const brokerTrnHoldingsKey = (brokerId: string): string =>
  `${trnsKey}/broker/${brokerId}/holdings`
export const cashLadderKey = (
  portfolioId: string,
  cashAssetId: string,
): string => `${trnsKey}/portfolio/${portfolioId}/cash-ladder/${cashAssetId}`

/** POST `{ portfolioId, data: [...] }`: creates the transactions. */
export function createTrns(request: unknown): Promise<Response> {
  return fetch(trnsKey, jsonInit("POST", request))
}

export function deleteTrn(trnId: string): Promise<Response> {
  return fetch(`${trnsKey}/trades/${trnId}`, {
    method: "DELETE",
  })
}

/** DELETE `/api/trns/{id}`: removes a proposed transaction. */
export function deleteTrnById(trnId: string): Promise<Response> {
  return fetch(trnKey(trnId), { method: "DELETE" })
}

/** Move a position (and optionally its cash) to another portfolio. */
export function moveTrns(request: unknown): Promise<Response> {
  return fetch(`${trnsKey}/move`, jsonInit("POST", request))
}

/** Propose broker-weighted sell transactions. */
export function proposeBrokerSells(
  brokerId: string,
  request: unknown,
): Promise<Response> {
  return fetch(
    `${trnsKey}/broker/${brokerId}/propose`,
    jsonInit("POST", request),
  )
}

export function settlePortfolioTrns(
  portfolioId: string,
  trnIds: string[],
): Promise<Response> {
  return fetch(
    `${trnsKey}/portfolio/${portfolioId}/settle`,
    jsonInit("POST", { trnIds }),
  )
}

export function unsettlePortfolioTrns(
  portfolioId: string,
  trnIds: string[],
): Promise<Response> {
  return fetch(
    `${trnsKey}/portfolio/${portfolioId}/unsettle`,
    jsonInit("POST", { trnIds }),
  )
}

/** PATCH `/api/trns/patch/{portfolioId}/{trnId}`: edit a proposed trn. */
export function patchTrn(
  portfolioId: string,
  trnId: string,
  request: unknown,
): Promise<Response> {
  return fetch(
    `${trnsKey}/patch/${portfolioId}/${trnId}`,
    jsonInit("PATCH", request),
  )
}

/** POST one delimited row to `/api/trns/import`. */
export function importTrnRow(request: unknown): Promise<Response> {
  return fetch(`${trnsKey}/import`, {
    method: "POST",
    mode: "cors",
    headers: {
      "content-type": "application/json;charset=UTF-8",
    },
    body: JSON.stringify(request),
  })
}

/**
 * PATCH /trns/{trnId}/status — Unsettle a SETTLED trn (sets PROPOSED).
 * Response: { updated, siblings: string[] } — the server reverts the
 * auto-settled cash legs (WITHDRAWAL + DEPOSIT) to PROPOSED on unsettle; they
 * are not deleted. `siblings` lists their ids; a list refresh shows them as PROPOSED.
 */
export function unsettleTrn(trnId: string): Promise<Response> {
  return fetch(`${trnsKey}/status/${trnId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: TRN_STATUS.PROPOSED }),
  })
}

export interface TrnUpdatePayload {
  trnType: string
  assetId: string
  tradeDate: string
  quantity: number
  price: number
  tradeCurrency: string
  tradeAmount: number
  cashCurrency: string
  cashAssetId?: string
  cashAmount: number
  tradeCashRate?: number
  fees: number
  tax: number
  comments?: string
  status?: string
  brokerId?: string
  /** Model ID for tracking which rebalance model this transaction belongs to */
  modelId?: string
  /** Per-sub-account split for composite policies (e.g. CPF OA/SA/MA). */
  subAccounts?: Record<string, number>
}

export function updateTrn(
  portfolioId: string,
  trnId: string,
  payload: TrnUpdatePayload,
): Promise<Response> {
  return fetch(`${trnKey(trnId)}?portfolioId=${portfolioId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}
