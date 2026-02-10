import { TradeFormData } from "types/beancounter"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"

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
  cashAccount: string // Asset ID for specific settlement account (e.g., bank account)
  cashCurrency: string // Currency code for settlement
  tradeDate: string
  quantity: number
  tradeCurrency: string
  price: number
  fees: number
  cashAmount: number
  comments: string
  status: string
  brokerId: string // Broker ID for the trade
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
  // EXPENSE: the user-entered tradeAmount is the cash debit
  if (data.type.value === "EXPENSE") {
    return -(data.tradeAmount || 0)
  }
  // INCOME: the user-entered tradeAmount is the cash credit
  if (data.type.value === "INCOME") {
    return data.tradeAmount || 0
  }
  // For FX trades, use cashAmount (the buy amount calculated from FX rate)
  // For other CASH market transactions, use quantity
  const cashAmount =
    data.type.value === "FX"
      ? (data.cashAmount ?? 0)
      : data.market === "CASH"
        ? data.quantity
        : (data.cashAmount ?? 0)
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

  // Settlement account: use currency from settlementAccount if available
  const settlementCurrency = data.settlementAccount?.currency || ""
  const finalCashCurrency = settlementCurrency || cashCurrency || tradeCurrency

  // CashAccount is the asset ID for a specific settlement account (bank account, etc.)
  // Empty string means use generic Cash Balance based on cashCurrency
  const cashAccount = data.settlementAccount?.value || ""

  const cashAmount = calculateCashAmount(data)
  const isExpense = data.type.value === "EXPENSE"
  const isIncome = data.type.value === "INCOME"
  const isSimpleAmount = isExpense || isIncome
  const rawAsset: string =
    data.market === "CASH"
      ? data.tradeCurrency && data.tradeCurrency.value
        ? data.tradeCurrency.value
        : ""
      : data.asset
  // Strip owner prefix from private asset codes (e.g., "userId.APT" → "APT")
  const asset = stripOwnerPrefix(rawAsset)

  // EXPENSE/INCOME: quantity is 1, price is the amount (form hides qty/price fields)
  const qty: number = isSimpleAmount
    ? 1
    : data.market === "CASH"
      ? (data.cashAmount ?? 0)
      : (data.quantity ?? 0)

  // Default to SETTLED if status not provided
  const status = data.status?.value ?? "SETTLED"

  // Broker ID for the trade
  const brokerId = data.brokerId ?? ""

  return {
    batchId,
    type: data.type.value,
    market: data.market,
    asset: asset,
    cashAccount,
    cashCurrency: finalCashCurrency,
    tradeDate: data.tradeDate,
    quantity: qty,
    tradeCurrency,
    price: isSimpleAmount ? data.tradeAmount || 0 : data.price,
    fees: data.fees,
    cashAmount,
    comments,
    status,
    brokerId,
  }
}

// Updated getTradeRow to use TradeImport object
// CSV columns: Batch,CallerId,Type,Market,Code,Name,CashAccount,CashCurrency,Date,Quantity,BaseRate,TradeCurrency,Price,Fees,PortfolioRate,TradeAmount,CashAmount,Comments,Status,Broker
export const getTradeRow = (data: TradeFormData): string => {
  const tradeImport = convertToTradeImport(data)
  return `${tradeImport.batchId},,${tradeImport.type},${tradeImport.market},${tradeImport.asset},,${tradeImport.cashAccount},${tradeImport.cashCurrency},${tradeImport.tradeDate},${tradeImport.quantity},,${tradeImport.tradeCurrency},${tradeImport.price},${tradeImport.fees},,,${tradeImport.cashAmount},${tradeImport.comments},${tradeImport.status},${tradeImport.brokerId}`
}

// Updated getCashRow to use TradeImport object
// CSV columns: Batch,CallerId,Type,Market,Code,Name,CashAccount,CashCurrency,Date,Quantity,BaseRate,TradeCurrency,Price,Fees,PortfolioRate,TradeAmount,CashAmount,Comments,Status,Broker
export const getCashRow = (data: TradeFormData): string => {
  const tradeImport = convertToTradeImport(data)

  // For FX trades, the format is different:
  // - Type: FX_BUY
  // - Code: Buy asset code (for bank accounts, just the account code like "SCB-USD")
  // - CashAccount: Sell asset code when selling from a bank account (e.g., "SCB-SGD")
  // - CashCurrency: Sell currency code (e.g., "SGD")
  // - Quantity: Buy amount (cashAmount)
  // - TradeCurrency: Buy currency code (e.g., "USD", not the asset code)
  // - CashAmount: Negative sell amount
  if (data.type.value === "FX") {
    const sellAmount = data.quantity ?? 0
    const buyAmount = data.cashAmount ?? 0
    // Use the actual currency code from tradeCurrency, not the asset code
    // For currencies, tradeCurrency.currency equals tradeCurrency.value
    // For bank accounts, tradeCurrency.currency is the account's currency (e.g., "USD")
    const sellCurrency =
      data.tradeCurrency?.currency || tradeImport.tradeCurrency
    // buyAssetCode is the asset code for the Code field (e.g., "SCB-USD")
    const buyAssetCode = tradeImport.cashCurrency
    // buyCurrency is the actual currency for the TradeCurrency field (e.g., "USD")
    const buyCurrency = data.cashCurrency?.currency || tradeImport.cashCurrency

    // For FX between bank accounts, the sell asset CODE goes in CashAccount field
    // The backend will look it up by code (or UUID for backward compatibility)
    // If sell side is a bank account (market is PRIVATE), use the asset code
    // Otherwise (selling from generic cash balance), leave CashAccount empty
    const sellAssetCode = data.market === "PRIVATE" ? data.asset || "" : ""

    const comment = `Buy ${buyCurrency}/Sell ${sellCurrency}`
    return `${tradeImport.batchId},,FX_BUY,${tradeImport.market},${buyAssetCode},,${sellAssetCode},${sellCurrency},${tradeImport.tradeDate},${buyAmount},,${buyCurrency},1,${tradeImport.fees},,,-${sellAmount},${comment},${tradeImport.status},${tradeImport.brokerId}`
  }

  return `${tradeImport.batchId},,${tradeImport.type},${tradeImport.market},${tradeImport.asset},,${tradeImport.cashAccount},${tradeImport.cashCurrency},${tradeImport.tradeDate},${tradeImport.cashAmount},,${tradeImport.tradeCurrency},${tradeImport.price},${tradeImport.fees},,,${tradeImport.cashAmount},${tradeImport.comments},${tradeImport.status},${tradeImport.brokerId}`
}

// Trade types that do not affect cash balances
const NO_CASH_IMPACT_TYPES = ["ADD", "REDUCE", "SPLIT"]

/**
 * Returns true if the trade type affects cash (BUY, SELL, DIVI, EXPENSE, etc).
 * ADD, REDUCE, and SPLIT do not impact cash.
 */
export const hasCashImpact = (tradeType: string): boolean =>
  !NO_CASH_IMPACT_TYPES.includes(tradeType)

/** Returns true if the trade type is EXPENSE */
export const isExpenseType = (tradeType: string): boolean =>
  tradeType === "EXPENSE"

/** Returns true if the trade type is INCOME */
export const isIncomeType = (tradeType: string): boolean =>
  tradeType === "INCOME"

/** Returns true if the trade type uses simplified amount-only form (hides qty/price/broker) */
export const isSimpleAmountType = (tradeType: string): boolean =>
  tradeType === "EXPENSE" || tradeType === "INCOME"

/**
 * Extract the currency code from an asset object.
 * CASH market assets use their code as the currency.
 * Other assets check accountingType, then priceSymbol, then market.currency.code.
 */
export const getAssetCurrency = (assetData: {
  code: string
  accountingType?: { currency?: { code?: string } }
  priceSymbol?: string
  market: { code: string; currency?: { code: string } }
}): string => {
  if (assetData.market?.code === "CASH") {
    return assetData.code
  }
  return (
    assetData.accountingType?.currency?.code ||
    assetData.priceSymbol ||
    assetData.market?.currency?.code ||
    ""
  )
}

/**
 * Derive the default market code from a portfolio's currency.
 * Finds the first market whose currency matches, or falls back to "US".
 */
export const deriveDefaultMarket = (
  currencyCode: string,
  markets: { code: string; currency: { code: string } }[],
  fallback: string = "US",
): string => {
  const match = markets.find((m) => m.currency.code === currencyCode)
  return match?.code || fallback
}

export const convert = (tradeFormData: TradeFormData): string => {
  // FX transactions always use getCashRow which handles FX -> FX_BUY conversion
  if (tradeFormData.type.value === "FX") {
    return getCashRow(tradeFormData)
  }
  return tradeFormData.market === "CASH"
    ? getCashRow(tradeFormData)
    : getTradeRow(tradeFormData)
}
