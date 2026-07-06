import {
  Transaction,
  QuickSellData,
  BrokerWithAccounts,
} from "types/beancounter"
import { SettlementAccountOption } from "@components/features/transactions/SettlementAccountSelect"
import {
  calculateTradeAmount,
  calculateTradeWeight,
  calculateNewPositionWeight,
  getAssetCurrency,
} from "./tradeUtils"
import { getDisplayCode, stripOwnerPrefix } from "@lib/assets/assetUtils"
import { deriveBrokerCode } from "@lib/openBrokerage/brokerCode"

// --- Weight and position calculations ---

export interface WeightInfo {
  label: string
  value: number
  tradeWeight?: number
}

export interface ComputeWeightInfoParams {
  quantity: number
  price: number
  tax: number
  fees: number
  tradeType: string
  portfolioMarketValue: number
  actualPositionQuantity: number
}

/**
 * Compute weight information for a trade.
 * Returns label, percentage value, and optional trade weight delta.
 */
export const computeWeightInfo = (
  params: ComputeWeightInfoParams,
): WeightInfo | null => {
  const {
    quantity,
    price,
    tax,
    fees,
    tradeType,
    portfolioMarketValue,
    actualPositionQuantity,
  } = params

  if (!quantity || !price || !portfolioMarketValue) return null

  const tradeAmount = calculateTradeAmount(
    quantity,
    price,
    tax,
    fees,
    tradeType,
  )

  if (tradeType === "SELL" && actualPositionQuantity > 0) {
    const newWeight = calculateNewPositionWeight(
      actualPositionQuantity,
      quantity,
      price,
      portfolioMarketValue,
    )
    const tradeWeight = calculateTradeWeight(tradeAmount, portfolioMarketValue)
    return { label: "New Weight", value: newWeight, tradeWeight }
  }

  if (tradeType === "BUY" && actualPositionQuantity > 0) {
    const currentPositionValue = actualPositionQuantity * price
    const newPositionValue = currentPositionValue + tradeAmount
    const newWeight = (newPositionValue / portfolioMarketValue) * 100
    const tradeWeight = calculateTradeWeight(tradeAmount, portfolioMarketValue)
    return { label: "New Weight", value: newWeight, tradeWeight }
  }

  if (tradeType === "BUY") {
    const weight = calculateTradeWeight(tradeAmount, portfolioMarketValue)
    return { label: "Trade Weight", value: weight }
  }

  if (tradeType === "SELL") {
    const weight = calculateTradeWeight(tradeAmount, portfolioMarketValue)
    return { label: "Selling", value: weight }
  }

  return null
}

/**
 * Compute the current position weight as a percentage of portfolio value.
 * Returns null if any required value is missing or zero.
 */
export const computeCurrentPositionWeight = (
  positionQuantity: number,
  price: number,
  portfolioMarketValue: number,
): number | null => {
  if (!positionQuantity || !price || !portfolioMarketValue) return null
  const positionValue = positionQuantity * price
  return (positionValue / portfolioMarketValue) * 100
}

/**
 * Calculate the quantity needed to reach a target weight.
 * Returns the number of shares and the trade type (BUY or SELL).
 */
export const calculateQuantityFromTargetWeight = (
  targetWeightPercent: number,
  currentPositionWeight: number,
  price: number,
  portfolioMarketValue: number,
): { quantity: number; tradeType: "BUY" | "SELL" } | null => {
  if (isNaN(targetWeightPercent) || !price || !portfolioMarketValue) return null

  const targetValue = (targetWeightPercent / 100) * portfolioMarketValue
  const currentValue = (currentPositionWeight / 100) * portfolioMarketValue
  const valueDiff = targetValue - currentValue
  const requiredShares = Math.round(Math.abs(valueDiff) / price)

  return {
    quantity: requiredShares,
    tradeType: valueDiff >= 0 ? "BUY" : "SELL",
  }
}

/**
 * Size a brand-new position (no existing holding) to a target weight of the
 * resulting, post-trade portfolio. The buy is funded from outside the
 * portfolio, so adding value V grows the total to (PV + V):
 *   w = V / (PV + V)  =>  V = w·PV / (1 - w)
 * Always a BUY. Returns null when the portfolio has no value yet (the first
 * position is 100% by definition, so a target weight is meaningless) or when
 * the weight is outside the reachable (0, 100) range.
 */
export const calculateNewPositionQuantityFromTargetWeight = (
  targetWeightPercent: number,
  price: number,
  portfolioMarketValue: number,
): {
  quantity: number
  tradeType: "BUY"
  nominalPortfolioValue: number
} | null => {
  if (isNaN(targetWeightPercent) || targetWeightPercent <= 0) return null
  if (targetWeightPercent >= 100) return null
  if (
    !price ||
    price <= 0 ||
    !portfolioMarketValue ||
    portfolioMarketValue <= 0
  )
    return null

  const w = targetWeightPercent / 100
  const targetValue = (w * portfolioMarketValue) / (1 - w)
  // Round (not floor) so we land on the nearest share to the target weight,
  // matching calculateQuantityFromTargetWeight and avoiding float undershoot.
  const quantity = Math.round(targetValue / price)
  return {
    quantity,
    tradeType: "BUY",
    nominalPortfolioValue: portfolioMarketValue + quantity * price,
  }
}

/**
 * Calculate quantity from a total investment value.
 * Returns floor of (value / price), or null if price is invalid.
 */
export const calculateQuantityFromTradeValue = (
  investmentValue: number,
  price: number,
): number | null => {
  if (isNaN(investmentValue) || !price || price <= 0) return null
  return Math.floor(investmentValue / price)
}

// --- Form initialization ---

/** Form values shape used by react-hook-form */
export interface TradeFormValues {
  type: { value: string; label: string }
  status: { value: string; label: string }
  asset: string
  assetId?: string // UUID — set by INCOME/EXPENSE quick actions from holdings
  market: string
  tradeDate: string
  quantity: number
  price: number
  tradeCurrency: { value: string; label: string }
  settlementAccount: SettlementAccountOption | null
  tradeAmount: number
  cashAmount: number
  fees: number
  tax: number
  comment: string
  brokerId: string
}

/**
 * Build form values from a Transaction for edit mode.
 */
export const buildEditModeValues = (
  transaction: Transaction,
): TradeFormValues => ({
  type: { value: transaction.trnType, label: transaction.trnType },
  status: { value: transaction.status, label: transaction.status },
  asset: getDisplayCode(transaction.asset),
  assetId: transaction.asset.id,
  market: transaction.asset.market.code,
  tradeDate: transaction.tradeDate,
  quantity: transaction.quantity,
  price: transaction.price,
  tradeCurrency: {
    value: transaction.tradeCurrency.code,
    label: transaction.tradeCurrency.code,
  },
  settlementAccount: buildInitialSettlementAccount(transaction),
  tradeAmount: transaction.tradeAmount,
  cashAmount: transaction.cashAmount,
  fees: transaction.fees,
  tax: transaction.tax,
  comment: transaction.comments || "",
  brokerId: transaction.broker?.id || "",
})

/**
 * Build form values from QuickSellData (row-level sell action).
 */
export const buildQuickSellValues = (
  quickSell: QuickSellData,
  defaults: TradeFormValues,
): TradeFormValues => {
  const tradeType = quickSell.type || "SELL"
  const currency = quickSell.currency
  return {
    ...defaults,
    type: { value: tradeType, label: tradeType },
    asset: quickSell.asset,
    assetId: quickSell.assetId,
    market: quickSell.market,
    quantity: quickSell.quantity,
    price: quickSell.price,
    ...(currency && {
      tradeCurrency: { value: currency, label: currency },
    }),
  }
}

/**
 * Build fresh form values for create mode with portfolio-appropriate defaults.
 */
export const buildCreateModeValues = (
  defaults: TradeFormValues,
  defaultMarket: string,
  currencyCode: string,
): TradeFormValues => ({
  ...defaults,
  market: defaultMarket,
  tradeCurrency: { value: currencyCode, label: currencyCode },
})

/**
 * Build a SettlementAccountOption from a Transaction's cashAsset.
 * Returns null if the transaction has no settlement account.
 */
export const buildInitialSettlementAccount = (
  transaction: Pick<Transaction, "cashAsset" | "tradeCurrency">,
): SettlementAccountOption | null => {
  if (!transaction.cashAsset) return null
  const asset = transaction.cashAsset
  return {
    value: asset.id,
    label:
      asset.name ||
      `${getDisplayCode(asset)}${asset.market?.code === "CASH" ? " Cash" : ""}`,
    currency:
      asset.accountingType?.currency?.code ||
      asset.priceSymbol ||
      asset.code ||
      transaction.tradeCurrency.code,
    market: asset.market?.code,
  }
}

// --- Settlement account resolution ---

interface AssetLike {
  id: string
  code: string
  name?: string
  market: { code: string; currency?: { code: string } }
  accountingType?: { currency?: { code?: string } }
  priceSymbol?: string
}

/**
 * Filter bank accounts by currency and sort alphabetically.
 */
export const filterBankAccountsByCurrency = (
  accounts: AssetLike[],
  currency: string,
): AssetLike[] =>
  accounts
    .filter((a) => getAssetCurrency(a) === currency)
    .sort((a, b) => (a.name || a.code).localeCompare(b.name || b.code))

/**
 * Build cash balance entries for all currencies, merging real assets with synthetic ones.
 * Sorts matching currency first, then alphabetically.
 */
export const buildAllCashBalances = (
  existingAssets: AssetLike[],
  currencies: string[],
  tradeCurrency: string,
): AssetLike[] => {
  const existingByCurrency = new Map<string, AssetLike>()
  existingAssets.forEach((asset) => {
    existingByCurrency.set(asset.code, asset)
  })

  const balances = currencies.map((code) => {
    const existing = existingByCurrency.get(code)
    if (existing) return existing
    return {
      id: `cash:${code}`,
      code,
      name: code,
      market: { code: "CASH" },
    }
  })

  return balances.sort((a, b) => {
    const aMatches = a.code === tradeCurrency ? 0 : 1
    const bMatches = b.code === tradeCurrency ? 0 : 1
    if (aMatches !== bMatches) return aMatches - bMatches
    return a.code.localeCompare(b.code)
  })
}

/**
 * Build default settlement option for a trade currency. Always returns the
 * generic `{ccy} Cash` asset so a broker with no explicit settlement
 * mapping doesn't accidentally route trades to an unrelated bank account
 * in the linked funding portfolio. Caller can still override via the
 * dropdown or via the broker's settlement-accounts mapping.
 */
export const buildDefaultCashAsset = (
  filteredCashAssets: AssetLike[],
  tradeCurrency: string,
): SettlementAccountOption => {
  const cashAsset = filteredCashAssets[0]
  if (cashAsset) {
    return {
      value: cashAsset.id,
      label: cashAsset.name || `${cashAsset.code} Cash`,
      currency: cashAsset.code,
      market: "CASH",
    }
  }
  return {
    value: `cash:${tradeCurrency}`,
    label: `${tradeCurrency} Cash`,
    currency: tradeCurrency,
    market: "CASH",
  }
}

/**
 * Resolve the settlement account for a broker and trade currency.
 * Looks up the broker's settlement mapping, then finds the matching bank account.
 * Falls back to the broker's first settlement account if no currency-specific match.
 */
export const resolveBrokerSettlementAccount = (params: {
  brokerId: string
  tradeCurrency: string
  brokers: BrokerWithAccounts[]
  allBankAccounts: AssetLike[]
}): SettlementAccountOption | null => {
  const { brokerId, tradeCurrency, brokers, allBankAccounts } = params

  const broker = brokers.find((b) => b.id === brokerId)
  if (!broker?.settlementAccounts?.length) return null

  // Prefer exact currency match, fall back to first available
  const settlement =
    broker.settlementAccounts.find((sa) => sa.currencyCode === tradeCurrency) ||
    broker.settlementAccounts[0]

  const bankAccount = allBankAccounts.find((a) => a.id === settlement.accountId)
  if (!bankAccount) return null

  return {
    value: bankAccount.id,
    label: bankAccount.name || bankAccount.code,
    currency: getAssetCurrency(bankAccount),
  }
}

/**
 * Check if a broker has a settlement account for a given currency.
 */
export const brokerHasSettlementForCurrency = (params: {
  brokerId: string
  tradeCurrency: string
  brokers: BrokerWithAccounts[]
}): boolean => {
  const { brokerId, tradeCurrency, brokers } = params
  const broker = brokers.find((b) => b.id === brokerId)
  return (
    broker?.settlementAccounts?.some(
      (sa) => sa.currencyCode === tradeCurrency,
    ) ?? false
  )
}

/**
 * Resolve the cash asset id to settle a broker's trade into, for a currency.
 * Prefers the broker's explicit settlement mapping; otherwise falls back to
 * the broker's own cash line by code convention (`{brokerCode}-{currency}`,
 * a PRIVATE/ACCOUNT asset) so brokers created before settlement-mapping
 * existed (or never configured) still route to their own cash, not a generic
 * CASH/{ccy}. Returns null when neither resolves — caller should then let the
 * backend pick its default. Asset codes carry an owner-id prefix, so match on
 * the stripped code.
 */
export const resolveBrokerCashAssetId = (params: {
  brokerId: string | undefined
  currency: string
  brokers: BrokerWithAccounts[]
  accountAssets: AssetLike[]
}): string | null => {
  const { brokerId, currency, brokers, accountAssets } = params
  if (!brokerId) return null
  const broker = brokers.find((b) => b.id === brokerId)
  if (!broker) return null

  // 1. Explicit per-currency settlement mapping.
  const mapped = broker.settlementAccounts?.find(
    (sa) => sa.currencyCode === currency,
  )?.accountId
  if (mapped) return mapped

  // 2. Convention: the broker's own {code}-{currency} cash line.
  const brokerCode = deriveBrokerCode(broker.name)
  if (!brokerCode) return null
  const target = `${brokerCode}-${currency}`
  const conv = accountAssets.find((a) => stripOwnerPrefix(a.code) === target)
  return conv?.id ?? null
}

// --- Sellable quantity resolution ---

/**
 * Quantity available to trade for the current form state. When a specific
 * broker is selected and per-broker holdings are known, this is the quantity
 * held BY THAT BROKER (svc-position `held`, split-adjusted, keyed by broker
 * name) rather than the whole-holding total. Falls back to the position total
 * when no broker is selected or the broker holds none of the tracked map.
 */
export const resolveSellableQuantity = (params: {
  held?: Record<string, number>
  brokerId?: string
  brokers: BrokerWithAccounts[]
  currentPositionQuantity?: number
  quantity?: number
}): number => {
  const { held, brokerId, brokers, currentPositionQuantity, quantity } = params
  const brokerName = brokerId
    ? brokers.find((b) => b.id === brokerId)?.name
    : undefined
  const perBroker = held && brokerName ? held[brokerName] : undefined
  return perBroker ?? currentPositionQuantity ?? quantity ?? 0
}
