/**
 * Independence formatter re-exports — single source of truth lives in @lib/formatters.
 * Preserves the original call-site contracts byte-for-byte:
 *   formatCurrency(value, symbol?)  — symbol-prefixed locale string  (was independence local)
 *   formatPercent(value, decimals?) — already-percent input           (was independence local)
 */
export {
  formatCurrencySymbol as formatCurrency,
  formatPercentValue as formatPercent,
} from "@lib/formatters"
