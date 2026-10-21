import type { Transaction, TrnType } from "./trn"

// ============ Brokers ============

/**
 * Broker/custodian where transactions are held.
 */
export interface Broker {
  id: string
  name: string
  accountNumber?: string
  notes?: string
}

export interface BrokerInput {
  name: string
  accountNumber?: string
  notes?: string
  // Map of currency code to settlement account asset ID
  settlementAccounts?: Record<string, string>
}

export interface BrokerResponse {
  data: Broker
}

export interface BrokersResponse {
  data: Broker[]
}

/**
 * Settlement account mapping for a broker (currency -> account).
 */
export interface SettlementAccountMapping {
  currencyCode: string
  accountId: string
  accountName?: string
}

/**
 * Broker with settlement accounts for API responses.
 */
export interface BrokerWithAccounts {
  id: string
  name: string
  accountNumber?: string
  notes?: string
  settlementAccounts: SettlementAccountMapping[]
}

export interface BrokerWithAccountsResponse {
  data: BrokerWithAccounts
}

export interface BrokersWithAccountsResponse {
  data: BrokerWithAccounts[]
}

/**
 * A single transaction for broker reconciliation drill-down.
 */
export interface BrokerHoldingTransaction {
  id: string
  portfolioId: string
  portfolioCode: string
  tradeDate: string
  trnType: string
  quantity: number
  price: number
  tradeAmount: number
}

/**
 * Transactions grouped by portfolio for a specific asset.
 */
export interface BrokerPortfolioGroup {
  portfolioId: string
  portfolioCode: string
  quantity: number
  transactions: BrokerHoldingTransaction[]
}

/**
 * A position held with a broker for reconciliation purposes.
 */
export interface BrokerHoldingPosition {
  assetId: string
  assetCode: string
  assetName?: string
  market: string
  quantity: number
  /**
   * Trading lot size: quantities must be whole multiples of this.
   * 0 = fractional quantities allowed. Absent (older responses) = 1.
   */
  boardLot?: number
  portfolioGroups: BrokerPortfolioGroup[]
}

/**
 * Response containing all holdings for a specific broker.
 */
export interface BrokerHoldingsResponse {
  brokerId: string
  brokerName: string
  holdings: BrokerHoldingPosition[]
}

/**
 * Request body for POST /trns/broker/{brokerId}/propose — creates one
 * PROPOSED transaction per portfolio holding the asset at that broker,
 * sized as `weight` (a fraction of each portfolio's held quantity).
 */
export interface BrokerProposalRequest {
  assetId: string
  trnType: TrnType
  weight: number
  price: number
  tradeDate?: string
}

/**
 * Response envelope from POST /trns/broker/{brokerId}/propose.
 */
export interface BrokerProposalResponse {
  data: Transaction[]
}

/**
 * A broker holding a specific asset — used by the asset lookup page's
 * Brokers tab (GET /trns/asset/{assetId}/brokers).
 */
export interface AssetBrokerHolding {
  brokerId: string
  brokerName: string
  holding: BrokerHoldingPosition
}

/**
 * Response envelope from GET /trns/asset/{assetId}/brokers.
 */
export interface AssetBrokerHoldingsResponse {
  data: AssetBrokerHolding[]
}
