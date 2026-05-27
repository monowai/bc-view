export function deleteTrn(trnId: string): Promise<Response> {
  return fetch(`/api/trns/trades/${trnId}`, {
    method: "DELETE",
  })
}

/**
 * PATCH /trns/{trnId}/status — Unsettle a SETTLED trn (sets PROPOSED).
 * Response: { updated, siblings: string[] } — siblings are the auto-emitted
 * cash legs (WITHDRAWAL + DEPOSIT) the UI prompts the user to delete.
 */
export function unsettleTrn(trnId: string): Promise<Response> {
  return fetch(`/api/trns/status/${trnId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PROPOSED" }),
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
