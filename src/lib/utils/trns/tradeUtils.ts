import { TradeFormData } from "types/beancounter"

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
  portfolioMarketValue: number
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
  portfolioMarketValue: number
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
