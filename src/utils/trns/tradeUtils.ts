import { TradeFormData } from "types/beancounter"

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
export const calculateCashAmount = (
  cashAmount: number,
  type: string,
): number => {
  if (type === "SPLIT") {
    return 0
  }
  return type === "BUY" ? -Math.abs(cashAmount) : Math.abs(cashAmount)
}

export const getTradeRow = (data: TradeFormData): string => {
  const batchDate = new Date()
  const batchId = `${batchDate.getFullYear()}${("0" + (batchDate.getMonth() + 1)).slice(-2)}${("0" + batchDate.getDate()).slice(-2)}`
  const tradeCurrency = data.tradeCurrency ? data.tradeCurrency.value : ""
  const comments = data.comments ? data.comments : ""
  const cash = data.cashAmount ?? 0
  const cashCurrency = data.cashCurrency ? data.cashCurrency.value : ""
  const cashAmount = calculateCashAmount(cash, data.type.value)
  return `${batchId},,${data.type.value},${data.market},${data.asset},,,${cashCurrency},${data.tradeDate},${data.quantity},,${tradeCurrency},${data.price},${data.fees},,,${cashAmount},${comments}`
}
