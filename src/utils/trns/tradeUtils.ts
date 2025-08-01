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
  const tradeCurrency = data.tradeCurrency ? data.tradeCurrency.value : ""
  const comments = data.comments ? data.comments : ""
  const cashCurrency = data.cashCurrency
    ? data.cashCurrency.value
    : tradeCurrency
  const cashAmount = calculateCashAmount(data)
  const asset: string =
    data.market === "CASH" ? data.tradeCurrency.value : data.asset

  const qty: number =
    data.market === "CASH" ? (data.cashAmount ?? 0) : (data.quantity ?? 0)

  return {
    batchId,
    type: data.type.value,
    market: data.market,
    asset: asset,
    cashCurrency,
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
