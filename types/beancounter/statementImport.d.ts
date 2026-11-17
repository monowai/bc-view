import type { GlobalBroker } from "./broker"

// ============ Screenshot import ============
// A screenshot of a brokerage's holdings page is read by svc-agent into a
// proposal, previewed against what is held by svc-data, and recorded only for
// the rows the user confirms.

/** What kind of brokerage page a screenshot shows. */
export type ScreenshotDocumentType = "HOLDINGS" | "TRANSACTIONS"

/**
 * One holding or one transaction as printed. Every field is optional: a
 * missing one was not on the screenshot.
 */
export interface ScreenshotProposalRow {
  code?: string | null
  name?: string | null
  assetType?: string | null
  quantity?: number | null
  price?: number | null
  marketValue?: number | null
  /** Total cost of the holding. */
  costBasis?: number | null
  costPerShare?: number | null
  gainLoss?: number | null
  currency?: string | null
  tradeDate?: string | null
  type?: string | null
  amount?: number | null
  fees?: number | null
}

/** Response of POST /agent/screenshot. Nothing in it is checked or recorded. */
export interface ScreenshotProposal {
  documentType: ScreenshotDocumentType
  /** The brokerage firm's name as printed. */
  brokerName?: string | null
  /** The visible digits of the account number; brokerages mask the rest. */
  accountNumber?: string | null
  asOf?: string | null
  totalShown?: number | null
  rows: ScreenshotProposalRow[]
}

/** One holding sent for preview. Only `code` is required. */
export interface ShownHolding {
  code: string
  market?: string
  quantity?: number
  /** Total cost of the shown holding. */
  costBasis?: number
  costPerShare?: number
  price?: number
  marketValue?: number
  gainLoss?: number
}

/** Request body of POST /brokers/reconcile. */
export interface ShownHoldings {
  /** Absent for a portfolio the user will create when recording. */
  portfolioId?: string
  /** The user's brokerage account, once they have chosen it. */
  brokerId?: string
  /** The firm of an account the user will create on record (no brokerId). */
  globalBrokerId?: string
  brokerName?: string
  accountNumber?: string
  rows: ShownHolding[]
}

export type ReconcileRowStatus =
  | "READY"
  | "UNCHANGED"
  | "NEEDS_QUANTITY"
  | "NEEDS_MARKET"
  | "UNRESOLVED"
  | "NEEDS_COST"

export type ReconcileRowWarning = "MARKET_VALUE_MISMATCH" | "GAIN_LOSS_MISMATCH"

/** Where svc-data found a row's market, strongest first. */
export type ReconcileMarketSource = "SHOWN" | "HELD" | "BROKERAGE" | "LISTED"

export type ReconcileTrnType = "ADD" | "REDUCE"

/** A shown holding beside what is held, and the change that would close the gap. */
export interface ReconcilePreviewRow {
  code: string
  market: string | null
  /** Null for a listing Beancounter does not have yet; recording creates it. */
  assetId: string | null
  /** The code Beancounter knows the asset by, e.g. BRK.B for a shown BRK/B. */
  assetCode?: string | null
  assetName: string | null
  shown: number | null
  /** Netted across all the user's portfolios at the brokerage account. */
  held: number
  /** Null unless `status` is READY or NEEDS_COST. */
  trnType: ReconcileTrnType | null
  /** The absolute difference between `shown` and `held`. */
  quantity: number | null
  /** The cost of `quantity`, for an ADD. */
  cost: number | null
  status: ReconcileRowStatus
  warnings: ReconcileRowWarning[]
  /** Where `market` came from; null when there is none. */
  marketSource?: ReconcileMarketSource | null
  /** The markets that list `code`, when svc-data looked them up. */
  listedOn?: string[]
}

/** The user's own brokerage account that a screenshot belongs to. */
export interface MatchedBroker {
  id: string
  name: string
  accountNumber: string | null
}

/** Held at the brokerage account but absent from the screenshot. */
export interface HeldNotShown {
  assetId: string
  code: string
  market: string
  quantity: number
}

export interface ReconcilePreview {
  globalBroker: GlobalBroker | null
  broker: MatchedBroker | null
  /** One per shown holding, in the order sent. */
  rows: ReconcilePreviewRow[]
  notShown: HeldNotShown[]
}

/** Response of POST /brokers/reconcile. Nothing has been recorded. */
export interface ReconcilePreviewResponse {
  data: ReconcilePreview
}

/** Names its asset by `assetId`, or by `market` and `code` for a listing new to Beancounter. */
export interface ConfirmedRow {
  assetId?: string
  market?: string
  code?: string
  trnType: ReconcileTrnType
  quantity: number
  /** Total cost of `quantity`; an ADD needs one. */
  cost?: number
}

/**
 * Request body of POST /brokers/reconcile/commit. The response is a
 * `TrnResponse`. One `uploadId` is recorded once.
 */
export interface ConfirmedHoldings {
  portfolioId: string
  brokerId: string
  uploadId: string
  /** yyyy-MM-dd, not in the future; today when absent. */
  tradeDate?: string
  rows: ConfirmedRow[]
}
