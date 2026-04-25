/**
 * Shared test fixtures for Beancounter domain types.
 *
 * Each builder accepts a `Partial<T>` overrides argument and returns a fully-formed
 * object matching the type's required fields. Use these in tests instead of hand-rolling
 * Position/Portfolio/Holdings shapes — keeps fixtures consistent as types evolve.
 *
 * Example:
 *   const position = makePosition({ asset: makeAsset({ code: "MSFT" }) })
 *   const holdings = makeHoldings({ holdingGroups: { Equity: makeHoldingGroup([position]) } })
 */
import {
  Asset,
  Currency,
  Holdings,
  HoldingGroup,
  MoneyValues,
  Portfolio,
  Position,
  QuantityValues,
} from "types/beancounter"
import { ValueIn } from "@components/features/holdings/GroupByOptions"

// MoneyValues uses an index signature that TS doesn't narrow neatly per-bucket.
// Use `Money` as a local alias for "the per-bucket money values" — semantically
// equivalent to Money without the type-lookup headaches.
type Money = MoneyValues

export const USD: Currency = { code: "USD", name: "US Dollar", symbol: "$" }
export const SGD: Currency = {
  code: "SGD",
  name: "Singapore Dollar",
  symbol: "S$",
}
export const NZD: Currency = {
  code: "NZD",
  name: "New Zealand Dollar",
  symbol: "NZ$",
}

export function makeCurrency(overrides: Partial<Currency> = {}): Currency {
  return { ...USD, ...overrides }
}

export function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-aapl",
    code: "AAPL",
    name: "Apple Inc.",
    assetCategory: { id: "equity", name: "Equity" },
    market: { code: "NASDAQ", name: "NASDAQ", currency: USD },
    ...overrides,
  } as Asset
}

export function makeCashAsset(currency: Currency = USD): Asset {
  return makeAsset({
    id: `cash-${currency.code.toLowerCase()}`,
    code: currency.code,
    name: `${currency.name} Cash`,
    assetCategory: { id: "CASH", name: "Cash" },
    market: { code: "CASH", name: "Cash", currency },
  })
}

export function makeMoneyValues(overrides: Partial<Money> = {}): Money {
  const { priceData: priceOverrides, ...rest } = overrides
  return {
    currency: USD,
    costValue: 10000,
    marketValue: 15000,
    unrealisedGain: 5000,
    realisedGain: 0,
    dividends: 0,
    fees: 0,
    tax: 0,
    cash: 0,
    purchases: 10000,
    sales: 0,
    costBasis: 10000,
    averageCost: 100,
    irr: 0.2,
    roi: 0.5,
    weight: 0.25,
    weightedIrr: 0.05,
    totalGain: 5000,
    gainOnDay: 100,
    valueIn: USD,
    priceData: {
      close: 150,
      previousClose: 149,
      change: 1,
      changePercent: 0.0067,
      priceDate: "2024-01-15",
      ...(priceOverrides as object),
    },
    ...rest,
  } as Money
}

export function makeQuantityValues(
  overrides: Partial<QuantityValues> = {},
): QuantityValues {
  return {
    total: 100,
    purchased: 100,
    sold: 0,
    precision: 0,
    ...overrides,
  }
}

export interface MakePositionOptions {
  asset?: Asset
  moneyValues?: Partial<Money>
  /** Convenience: sets priceData.close (and previousClose if not overridden). */
  price?: number
  /** Build the same MoneyValues for these buckets (default: ["PORTFOLIO"]) */
  buckets?: ValueIn[]
  quantityValues?: Partial<QuantityValues>
  overrides?: Partial<Position>
}

export function makePosition(options: MakePositionOptions = {}): Position {
  const {
    asset = makeAsset(),
    moneyValues = {},
    price,
    buckets = [ValueIn.PORTFOLIO],
    quantityValues = {},
    overrides = {},
  } = options

  const money = makeMoneyValues({
    ...moneyValues,
    ...(price !== undefined && {
      priceData: {
        close: price,
        previousClose: price,
        change: 0,
        changePercent: 0,
        priceDate: "2024-01-15",
      },
    }),
  })
  const moneyByBucket: Record<string, Money> = {}
  for (const b of buckets) moneyByBucket[b] = money

  return {
    asset,
    moneyValues: moneyByBucket,
    quantityValues: makeQuantityValues(quantityValues),
    dateValues: {
      opened: "2023-01-01",
      last: "2024-01-15",
      closed: null,
      lastDividend: null,
    },
    lastTradeDate: "2024-01-15",
    roi: 0.5,
    ...overrides,
  } as unknown as Position
}

export interface MakeHoldingGroupOptions {
  positions?: Position[]
  subTotals?: Partial<Money>
  buckets?: ValueIn[]
}

export function makeHoldingGroup(
  options: MakeHoldingGroupOptions = {},
): HoldingGroup {
  const {
    positions = [makePosition()],
    subTotals = {},
    buckets = [ValueIn.PORTFOLIO],
  } = options

  const money = makeMoneyValues({
    marketValue: 15000,
    totalGain: 5000,
    gainOnDay: 100,
    weight: 1,
    ...subTotals,
  })
  const subTotalsByBucket: Record<string, Money> = {}
  for (const b of buckets) subTotalsByBucket[b] = money

  return {
    positions,
    subTotals: subTotalsByBucket,
  } as unknown as HoldingGroup
}

export function makePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: "p-1",
    code: "TEST",
    name: "Test Portfolio",
    currency: USD,
    base: USD,
    marketValue: 15000,
    irr: 0.1,
    ...overrides,
  } as Portfolio
}

export interface MakeHoldingsOptions {
  portfolio?: Portfolio
  holdingGroups?: Record<string, HoldingGroup>
  totals?: Partial<Holdings["totals"]>
  /**
   * Per-portfolio aggregate row consumed by `GrandTotal`. Pass `null` to
   * simulate the missing-totals branch.
   */
  viewTotals?: Partial<Money> | null
  valueIn?: ValueIn
}

export function makeHoldings(options: MakeHoldingsOptions = {}): Holdings {
  const {
    portfolio = makePortfolio(),
    holdingGroups = { Equity: makeHoldingGroup() },
    totals = {},
    viewTotals,
    valueIn = ValueIn.PORTFOLIO,
  } = options

  return {
    holdingGroups,
    currency: portfolio.currency,
    portfolio,
    valueIn,
    viewTotals:
      viewTotals === null
        ? undefined
        : makeMoneyValues({ currency: portfolio.currency, ...viewTotals }),
    totals: {
      marketValue: 15000,
      purchases: 10000,
      sales: 0,
      cash: 0,
      income: 0,
      gain: 5000,
      irr: 0.2,
      currency: portfolio.currency,
      ...totals,
    },
  } as unknown as Holdings
}
