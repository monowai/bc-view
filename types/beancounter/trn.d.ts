import type { Asset, Currency } from "./asset"
import type { Broker } from "./broker"
import type { Portfolio } from "./portfolio"

export type TrnType =
  | "BUY"
  | "SELL"
  | "DIVI"
  | "SPLIT"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "INCOME"
  | "DEDUCTION"
  | "FX"
  | "FX_BUY"
  | "ADD"
  | "REDUCE"
  | "BALANCE"
  | "COST_ADJUST"
  | "EXPENSE"

export type TrnStatus = "PROPOSED" | "SETTLED"

// Server side contract
export interface TransactionImport {
  portfolio: Portfolio
  purge: boolean
}

export interface TrnInput {
  trnType: TrnType
  portfolioId: string
  assetId: string
  tradeDate: string
  quantity: number
  price: number
  tradeCurrency: string
  tradeAmount: number
  tradeBaseRate: number
  tradePortfolioRate: number
  cashCurrency?: string
  cashAssetId?: string // Settlement account asset ID
  cashAmount: number
  tradeCashRate: number
  fees: number
  tax: number
}

export interface TradeFormData {
  type: { value: string; label: string }
  status?: { value: string; label: string }
  asset: string
  market: string
  tradeDate: string
  quantity: number
  price: number
  tradeCurrency: {
    value: string
    label: string
    currency?: string
    market?: string
  }
  cashCurrency?: {
    value: string
    label: string
    currency?: string
    market?: string
  }
  settlementAccount?: { value: string; label: string; currency: string } // Asset ID, display label, and currency
  tradeAmount?: number
  cashAmount?: number
  fees: number
  tax: number
  comments: string | undefined
  brokerId?: string // Optional broker ID for the trade
}

export interface CallerRef {
  provider: string
  batch: string
  callerId: string
}

export interface Transaction {
  id: string
  callerRef: CallerRef
  trnType: TrnType
  status: TrnStatus
  portfolio: Portfolio
  asset: Asset
  cashAsset?: Asset // Settlement account asset
  tradeDate: string
  quantity: number
  price: number
  tradeCurrency: Currency
  tradeAmount: number
  tradeBaseRate: number
  tradePortfolioRate: number
  cashCurrency: string
  cashAmount: number
  tradeCashRate: number
  fees: number
  tax: number
  comments: string
  broker?: Broker
  /** Broker ID when broker object is not populated */
  brokerId?: string
  /** Model ID for tracking which rebalance model this transaction belongs to */
  modelId?: string
  subAccounts?: Record<string, number>
}

/**
 * Wire-format Trn record matching the backend `TrnDto`. Asset, Portfolio,
 * Currency, and Broker are referenced by id/code; the actual objects live
 * in the parent [[TrnPayload]] maps. Re-hydrate via
 * `denormalizeTrnPayload` when components need the fat [[Transaction]].
 */
export interface TrnDto {
  id: string
  callerRef: CallerRef | null
  trnType: TrnType
  status: TrnStatus
  portfolioId: string
  assetId: string
  cashAssetId: string | null
  tradeDate: string
  quantity: number
  price: number | null
  tradeCurrencyCode: string
  tradeAmount: number
  tradeBaseRate: number
  tradePortfolioRate: number
  cashCurrencyCode: string | null
  cashAmount: number
  tradeCashRate: number
  fees: number
  tax: number
  comments: string | null
  brokerId: string | null
  modelId: string | null
  subAccounts: Record<string, number> | null
}

/**
 * Normalised envelope returned by every `/api/trns/...` endpoint.
 * De-duplicates Asset / Portfolio / Currency / Broker references across
 * many trns in a single response.
 */
export interface TrnPayload {
  trns: TrnDto[]
  assets: Record<string, Asset>
  portfolios: Record<string, Portfolio>
  currencies: Record<string, Currency>
  brokers: Record<string, Broker>
}

/**
 * Split-adjusted quantity held for one group (a broker or a portfolio) of an
 * asset's trades. `groupId` is the broker id ("" for "No Broker") or the
 * portfolio id, matching {@link TrnTradeSummary.groupBy}.
 */
export interface TrnGroupTotal {
  groupId: string
  quantity: number
  // Broker breakdown of a portfolio group (empty for broker grouping). Each
  // sub-total is split-adjusted; summing them reconstructs `quantity`.
  subTotals?: TrnGroupTotal[]
}

/**
 * Server-computed, split-adjusted quantity per group for a trade drill-down.
 * The UI reads the authoritative quantity from here instead of summing raw
 * `trn.quantity` — a SPLIT row carries the ratio, not shares.
 */
export interface TrnTradeSummary {
  groupBy: "BROKER" | "PORTFOLIO"
  groups: TrnGroupTotal[]
}

/**
 * Top-level response envelope from backend trn endpoints.
 */
export interface TrnResponse {
  data: TrnPayload
  // Non-fatal hints raised while persisting / settling (e.g. auto-settle
  // skipped because the master funding portfolio has no balance in the
  // trade's settlement currency). Surfaced to the UI as toasts.
  warnings?: string[]
  // Split-adjusted quantity per group, present only on asset trade lists.
  summary?: TrnTradeSummary
}

/**
 * Response from DELETE /trns/{id}. Auto-settled cash legs share the
 * parent's group key (provider=BC-AUTO, batch=parent.callerId) — server
 * returns their ids in [siblings] so the UI can prompt the user before
 * issuing follow-up DELETEs.
 */
export interface TrnDeleteResponse {
  data: string[]
  siblings?: string[]
}

/**
 * Request body for PATCH /trns/{trnId}/status (Unsettle action).
 */
export interface TrnStatusUpdateRequest {
  status: TrnStatus
}

/**
 * Response from PATCH /trns/{trnId}/status. [siblings] is the auto-settled
 * cash leg ids; they are reverted to PROPOSED server-side (not deleted).
 */
export interface TrnStatusUpdateResponse {
  updated: TrnDto
  siblings?: string[]
}
