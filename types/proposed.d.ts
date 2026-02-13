import { Transaction, TrnStatus } from "./beancounter"

export interface ProposedTransaction extends Transaction {
  editedPrice?: number
  editedFees?: number
  editedStatus?: TrnStatus
  editedTradeDate?: string
  editedBrokerId?: string
}

// Aggregated transaction for efficient execution view
export interface AggregatedTransaction {
  aggregateKey: string // broker:asset key
  brokerId: string | undefined
  brokerName: string
  assetId: string
  assetCode: string
  assetName: string
  assetMarket: { code: string }
  trnType: string
  tradeCurrency: { code: string }
  totalQuantity: number
  avgPrice: number
  totalFees: number
  totalAmount: number
  transactionIds: string[]
  transactions: ProposedTransaction[]
  // Editable fields that apply to all underlying transactions
  editedPrice?: number
  editedFees?: number
  editedStatus?: TrnStatus
  editedTradeDate?: string
}
