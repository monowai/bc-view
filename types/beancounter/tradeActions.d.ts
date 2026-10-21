import type { Asset, Currency } from "./asset"

export interface QuickSellData {
  asset: string
  assetId?: string // UUID — used by INCOME/EXPENSE REST payloads
  currency?: string // Trade currency code (e.g., "NZD") for settlement grouping
  market: string
  quantity: number
  price: number
  type?: "BUY" | "SELL" | "INCOME" | "EXPENSE"
  currentPositionQuantity?: number // For rebalance: the current position size
  held?: Record<string, number> // Broker name -> quantity for broker selection
  // Displayed-currency -> portfolio-currency rate, so the trade dialog can
  // weigh the price the row displayed against the portfolio value. Omitted
  // when the row already displays portfolio currency (treated as 1).
  fxRate?: number
  // The position's weight in percent, as svc-position computed it. The dialog
  // displays this rather than re-deriving one, so the two agree.
  currentWeight?: number
}

export interface RebalanceData {
  asset: string
  market: string
  quantity: number
  price: number
  type: "BUY" | "SELL"
  currentPositionQuantity: number
}

// Overrides the default query/context sent to /api/agent/query/stream by
// AssetInsightPopup — lets callers outside the rebalance-model editor (e.g.
// the rebalance execute page) seed the popup with their own question while
// reusing the same streaming Dialog wrapper.
export interface AssetInsightPromptOverride {
  query: string
  context: Record<string, unknown>
}

export interface WeightClickData {
  asset: Asset
  currentWeight: number
  currentQuantity: number
  currentPrice: number
  // Trade-currency -> portfolio-currency rate, so the rebalance dialog can
  // weigh `currentPrice` (the asset's own trade currency) against
  // portfolio.marketValue (portfolio currency). Omitted/1 when they already
  // match. Mirrors QuickSellData.fxRate.
  fxRate?: number
}

export interface SetCashBalanceData {
  currency: string // Currency code (e.g., "USD", "NZD")
  currentBalance: number // Current cash balance
  assetCode?: string // Asset code for bank accounts (e.g., "WISE", "USD-SAVINGS")
  assetName?: string // Asset name for display
  market?: string // Market code: "CASH" for currencies, "PRIVATE" for bank accounts
  assetId: string // Asset id — the write target, and the settlement account for the adjustment
}

export interface CashTransferData {
  portfolioId: string
  portfolioCode: string
  assetId: string
  assetCode: string
  assetName: string
  currency: string
  currentBalance: number
}

export interface SetPriceData {
  asset: Asset
}

export interface SetBalanceData {
  asset: Asset
}

export interface CostAdjustData {
  asset: Asset
  portfolioId: string
  currentCostBasis: number // Current cost basis for reference
  currency: Currency // Trade currency for the position
}

export interface MovePositionData {
  asset: Asset
  portfolioId: string
  portfolioCode: string
}
