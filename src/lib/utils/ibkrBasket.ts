import { Transaction } from "types/beancounter"
import { escapeCSV } from "@lib/csvExport"

// TWS BasketTrader import format. Column order and header text are exact;
// TWS also requires no space after the comma separator.
const HEADER =
  "Action,Quantity,Symbol,SecType,Exchange,Currency,TimeInForce,OrderType,LmtPrice,BasketTag"

// BC market code → IBKR exchange. US listings route via SMART; anything
// unmapped also falls back to SMART and TWS resolves the listing itself.
const EXCHANGE_ALIASES: Record<string, string> = {
  NYSE: "SMART",
  NASDAQ: "SMART",
  US: "SMART",
  AMEX: "SMART",
  LON: "LSE",
  LSE: "LSE",
  ASX: "ASX",
  SGX: "SGX",
  NZX: "NZSE",
  TSX: "TSE",
}

// Plain decimal (no exponent) with trailing zeros stripped, e.g. 100.0 → "100".
const plainDecimal = (value: number): string =>
  value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "")

/**
 * Build a TWS BasketTrader CSV from proposed transactions. Only BUY and SELL
 * rows are exportable orders; all other trn types are skipped.
 */
export function buildIbkrBasketCsv(trns: Transaction[]): string {
  const rows = trns
    .filter((trn) => trn.trnType === "BUY" || trn.trnType === "SELL")
    .map((trn) => {
      const isLimit = typeof trn.price === "number" && trn.price > 0
      const tag = `BC-${trn.id ?? trn.callerRef?.callerId ?? ""}`
      return [
        trn.trnType,
        plainDecimal(Math.abs(trn.quantity)),
        escapeCSV(trn.asset.code),
        "STK",
        EXCHANGE_ALIASES[trn.asset.market.code] ?? "SMART",
        trn.tradeCurrency.code,
        "DAY",
        isLimit ? "LMT" : "MKT",
        isLimit ? plainDecimal(trn.price) : "",
        escapeCSV(tag),
      ].join(",")
    })
  return [HEADER, ...rows].join("\n")
}

export function ibkrBasketFilename(asAt: string): string {
  return `ibkr-basket-${asAt}.csv`
}
