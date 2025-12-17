import { TradeFormData } from "types/beancounter"

// Cash transaction types
export type CashTrnType = "DEPOSIT" | "WITHDRAWAL" | "FX"

// Parameters for building a cash transaction row
export interface CashRowParams {
  type: CashTrnType
  currency: string
  amount: number // Absolute value - sign is determined by type
  tradeDate?: string // Defaults to today
  comments?: string
  batchId?: string // Defaults to generated from date
  market?: string // Defaults to "CASH", use "PRIVATE" for bank accounts
  assetCode?: string // Asset code, defaults to currency
}

// Build a cash transaction row array for import
export const buildCashRow = (params: CashRowParams): string[] => {
  const {
    type,
    currency,
    amount,
    tradeDate = new Date().toISOString().split("T")[0],
    comments = "",
    batchId = generateBatchId(),
    market = "CASH",
    assetCode,
  } = params

  const asset = assetCode || currency

  return [
    batchId, // batchId
    "", // callerId (empty)
    type, // type (DEPOSIT/WITHDRAWAL/FX)
    market, // market (CASH or PRIVATE for bank accounts)
    asset, // asset (currency code or account code)
    "", // name (empty)
    "", // cashAccount (empty)
    currency, // cashCurrency
    tradeDate, // tradeDate
    String(Math.abs(amount)), // quantity (absolute - backend enforces sign based on type)
    "", // baseRate (empty)
    currency, // tradeCurrency
    "", // price (empty for cash)
    "", // fees (empty)
    "", // portfolioRate (empty)
    "", // tradeAmount (empty)
    String(Math.abs(amount)), // cashAmount (absolute - backend enforces sign based on type)
    comments, // comments
  ]
}

// Calculate the cash adjustment needed to reach a target balance
export interface CashBalanceAdjustment {
  type: CashTrnType
  amount: number // Absolute value
  newBalance: number
}

export const calculateCashAdjustment = (
  currentBalance: number,
  targetBalance: number,
): CashBalanceAdjustment => {
  const diff = targetBalance - currentBalance
  return {
    type: diff >= 0 ? "DEPOSIT" : "WITHDRAWAL",
    amount: Math.abs(diff),
    newBalance: targetBalance,
  }
}

export interface TradeImport {
  batchId: string
  type: string
  market: string
  asset: string
  cashCurrency: string
  tradeDate: string
  quantity: number
  tradeCurrency: string
  price: number
  fees: number
  cashAmount: number
  comments: string
}

export const calculateTradeAmount = (
  quantity: number,
  price: number,
  tax: number,
  fees: number,
  type: string,
): number => {
  const qty = Number(quantity)
  const prc = Number(price)
  const tx = Number(tax)
  const fee = Number(fees)
  return type === "SELL" ? qty * prc - tx - fee : qty * prc + fee + tx
}

/**
 * Calculate the weight (%) a trade would represent in the portfolio.
 * For BUY: tradeAmount / portfolioMarketValue
 * For SELL: tradeAmount / portfolioMarketValue (shows reduction)
 */
export const calculateTradeWeight = (
  tradeAmount: number,
  portfolioMarketValue: number,
): number => {
  if (portfolioMarketValue <= 0) return 0
  return (Math.abs(tradeAmount) / portfolioMarketValue) * 100
}

/**
 * Calculate the new position weight after a SELL trade.
 * Uses the initial quantity (total held) and the quantity being sold.
 */
export const calculateNewPositionWeight = (
  initialQuantity: number,
  sellQuantity: number,
  price: number,
  portfolioMarketValue: number,
): number => {
  if (portfolioMarketValue <= 0 || initialQuantity <= 0) return 0
  const remainingQuantity = Math.max(0, initialQuantity - sellQuantity)
  const remainingValue = remainingQuantity * price
  return (remainingValue / portfolioMarketValue) * 100
}

// ensures the cash amount is correctly signed for supplied Transaction Type
export const calculateCashAmount = (data: TradeFormData): number => {
  if (data.type.value === "SPLIT") {
    return 0
  }
  const cashAmount =
    data.market === "CASH" ? data.quantity : (data.cashAmount ?? 0)
  return data.type.value === "WITHDRAWAL" || data.type.value === "BUY"
    ? -Math.abs(cashAmount)
    : Math.abs(cashAmount)
}

export const generateBatchId = (date: Date = new Date()): string => {
  return `${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(-2)}${("0" + date.getDate()).slice(-2)}`
}

// Function to convert TradeFormData into TradeImport
export const convertToTradeImport = (data: TradeFormData): TradeImport => {
  const batchDate = new Date()
  const batchId = generateBatchId(batchDate)
  // Determine tradeCurrency, defaulting to cashCurrency if missing/empty
  let tradeCurrency =
    data.tradeCurrency && data.tradeCurrency.value
      ? data.tradeCurrency.value
      : ""
  const cashCurrency =
    data.cashCurrency && data.cashCurrency.value ? data.cashCurrency.value : ""
  if (!tradeCurrency && cashCurrency) {
    tradeCurrency = cashCurrency
  }
  const comments = data.comments ? data.comments : ""
  const finalCashCurrency = cashCurrency || tradeCurrency
  const cashAmount = calculateCashAmount(data)
  const asset: string =
    data.market === "CASH"
      ? data.tradeCurrency && data.tradeCurrency.value
        ? data.tradeCurrency.value
        : ""
      : data.asset

  const qty: number =
    data.market === "CASH" ? (data.cashAmount ?? 0) : (data.quantity ?? 0)

  return {
    batchId,
    type: data.type.value,
    market: data.market,
    asset: asset,
    cashCurrency: finalCashCurrency,
    tradeDate: data.tradeDate,
    quantity: qty,
    tradeCurrency,
    price: data.price,
    fees: data.fees,
    cashAmount,
    comments,
  }
}

// Updated getTradeRow to use TradeImport object
export const getTradeRow = (data: TradeFormData): string => {
  const tradeImport = convertToTradeImport(data)
  return `${tradeImport.batchId},,${tradeImport.type},${tradeImport.market},${tradeImport.asset},,,${tradeImport.cashCurrency},${tradeImport.tradeDate},${tradeImport.quantity},,${tradeImport.tradeCurrency},${tradeImport.price},${tradeImport.fees},,,${tradeImport.cashAmount},${tradeImport.comments}`
}

// Updated getCashRow to use TradeImport object
export const getCashRow = (data: TradeFormData): string => {
  const tradeImport = convertToTradeImport(data)
  return `${tradeImport.batchId},,${tradeImport.type},${tradeImport.market},${tradeImport.asset},,,${tradeImport.cashCurrency},${tradeImport.tradeDate},${tradeImport.cashAmount},,${tradeImport.tradeCurrency},${tradeImport.price},${tradeImport.fees},,,${tradeImport.cashAmount},${tradeImport.comments}`
}

export const convert = (tradeFormData: TradeFormData): string => {
  return tradeFormData.market === "CASH"
    ? getCashRow(tradeFormData)
    : getTradeRow(tradeFormData)
}
