import {
  Asset,
  Holdings,
  HoldingGroup,
  MoneyValues,
  Portfolio,
  PortfolioBreakdown,
  Position,
  QuantityValues,
  SubTotalValues,
} from "types/beancounter"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import { USD, makeAsset } from "./asset"
import { makePortfolio } from "./portfolio"

// `Money` is a position's per-bucket MoneyValues, in the shape svc-position sends.
type Money = MoneyValues

export function makeMoneyValues(overrides: Partial<Money> = {}): Money {
  const { priceData: priceOverrides, ...rest } = overrides
  return {
    currency: USD,
    costValue: 10000,
    marketValue: 15000,
    unrealisedGain: 5000,
    realisedGain: 0,
    dividends: 0,
    expenses: 0,
    fees: 0,
    earmarked: 0,
    purchases: 10000,
    sales: 0,
    costBasis: 10000,
    averageCost: 100,
    irr: 0.2,
    roi: 0.5,
    weight: 0.25,
    totalGain: 5000,
    gainOnDay: 100,
    priceData: {
      close: 150,
      previousClose: 149,
      change: 1,
      changePercent: 0.0067,
      priceDate: "2024-01-15",
      ...priceOverrides,
    },
    ...rest,
  }
}

/** Client-computed group subtotal / view total, as calculateHoldings builds it. */
export function makeSubTotalValues(
  overrides: Partial<SubTotalValues> = {},
): SubTotalValues {
  return {
    currency: USD,
    costValue: 10000,
    marketValue: 15000,
    dividends: 0,
    purchases: 10000,
    sales: 0,
    realisedGain: 0,
    unrealisedGain: 5000,
    totalGain: 5000,
    gainOnDay: 100,
    weight: 0.25,
    weightedIrr: 0.05,
    ...overrides,
  }
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
  overrides?: Record<string, unknown>
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
  subTotals?: Partial<SubTotalValues>
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

  const money = makeSubTotalValues({
    marketValue: 15000,
    totalGain: 5000,
    gainOnDay: 100,
    weight: 1,
    ...subTotals,
  })
  const subTotalsByBucket: Record<string, SubTotalValues> = {}
  for (const b of buckets) subTotalsByBucket[b] = money

  return {
    positions,
    subTotals: subTotalsByBucket,
  } as unknown as HoldingGroup
}

export function makePortfolioBreakdown(
  overrides: Partial<PortfolioBreakdown> = {},
): PortfolioBreakdown {
  return {
    portfolioId: "p-1",
    portfolioCode: "TEST",
    portfolioName: "Test Portfolio",
    quantity: 100,
    ...overrides,
  }
}

export interface MakeHoldingsOptions {
  portfolio?: Portfolio
  holdingGroups?: Record<string, HoldingGroup>
  totals?: Partial<Holdings["totals"]>
  /**
   * Per-portfolio aggregate row consumed by `GrandTotal`. Pass `null` to
   * simulate the missing-totals branch.
   */
  viewTotals?: Partial<SubTotalValues> | null
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
    // Passing null intentionally produces a Holdings with no viewTotals so
    // tests can exercise the missing-totals branch. The outer
    // `as unknown as Holdings` cast covers this deliberate type bypass.
    viewTotals:
      viewTotals === null
        ? undefined
        : makeSubTotalValues({ currency: portfolio.currency, ...viewTotals }),
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
