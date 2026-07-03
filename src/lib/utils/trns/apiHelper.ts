import { TRN_STATUS } from "types/constants"

export function deleteTrn(trnId: string): Promise<Response> {
  return fetch(`/api/trns/trades/${trnId}`, {
    method: "DELETE",
  })
}

/**
 * PATCH /trns/{trnId}/status — Unsettle a SETTLED trn (sets PROPOSED).
 * Response: { updated, siblings: string[] } — the server cascade-deletes the
 * auto-emitted cash legs (WITHDRAWAL + DEPOSIT) on unsettle; `siblings` reports
 * the removed ids for reference (no longer a delete prompt).
 */
export function unsettleTrn(trnId: string): Promise<Response> {
  return fetch(`/api/trns/status/${trnId}`, {
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
  return fetch(`/api/trns/${trnId}?portfolioId=${portfolioId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}
