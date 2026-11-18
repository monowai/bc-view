import { Transaction } from "types/beancounter"
import { getDisplayCode } from "@lib/assets/assetUtils"
import { TRN_STATUS } from "types/constants"

type NumericField = "fees" | "tax" | "quantity" | "price" | "tradeAmount"

/** True when at least one transaction carries a non-zero value in `field`. */
export function anyNonZero(trns: Transaction[], field: NumericField): boolean {
  return trns.some((trn) => !!trn[field])
}

/** The trade currency code every transaction shares, else undefined. */
export function uniformCurrency(trns: Transaction[]): string | undefined {
  const codes = new Set(trns.map((trn) => trn.tradeCurrency?.code))
  return codes.size === 1 ? [...codes][0] : undefined
}

export interface YearGroup {
  year: string
  transactions: Transaction[]
  totals: { tradeAmount: number; tax: number }
}

/**
 * Groups transactions by the year of their trade date. Rows arrive newest
 * first from the server, so years come out newest first and each keeps its
 * row order.
 */
export function groupByYear(trns: Transaction[]): YearGroup[] {
  const years = new Map<string, YearGroup>()
  for (const trn of trns) {
    const year = trn.tradeDate.slice(0, 4)
    let group = years.get(year)
    if (!group) {
      group = { year, transactions: [], totals: { tradeAmount: 0, tax: 0 } }
      years.set(year, group)
    }
    group.transactions.push(trn)
    group.totals.tradeAmount += trn.tradeAmount || 0
    group.totals.tax += trn.tax || 0
  }
  return [...years.values()]
}

/** Types that move units or cost but never cash, so have no settlement account. */
const NO_CASH_TYPES = ["ADD", "REDUCE", "SPLIT", "COST_ADJUST"]

/** The account a transaction settled to, or undefined when it moves no cash. */
export function settlementLabel(trn: Transaction): string | undefined {
  if (NO_CASH_TYPES.includes(trn.trnType)) return undefined
  const cash = trn.cashAsset
  if (cash?.market?.code === "CASH") return cash.name || `${cash.code} Balance`
  if (cash) return cash.name || getDisplayCode(cash)
  // cashCurrency is typed as a code, but older payloads send the Currency.
  const cashCurrency = trn.cashCurrency as unknown as
    string | { code?: string } | undefined
  const code =
    (typeof cashCurrency === "string" ? cashCurrency : cashCurrency?.code) ||
    trn.tradeCurrency?.code
  return `${code} Balance`
}

export interface TabSignal {
  count: number
  proposed: number
}

/** What a list tab says about its rows; undefined while they load. */
export function tabSignal(
  trns: Transaction[] | undefined,
): TabSignal | undefined {
  if (!trns) return undefined
  return {
    count: trns.length,
    proposed: trns.filter((trn) => trn.status === TRN_STATUS.PROPOSED).length,
  }
}
