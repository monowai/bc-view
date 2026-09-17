/**
 * Shared formatting utilities for currency, percentage, and date display.
 */

/**
 * Format a number as currency with locale-aware formatting.
 * @param value - Numeric value to format
 * @param fractionDigits - Number of decimal places (default: 2)
 * @returns Formatted currency string (e.g., "1,234.56")
 */
export const formatCurrency = (value: number, fractionDigits = 2): string => {
  return new Intl.NumberFormat(undefined, {
    style: "decimal",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

/**
 * Format a number as percentage from a decimal value.
 * @param value - Numeric value as decimal (e.g., 0.25 for 25%)
 * @param fractionDigits - Number of decimal places (default: 2)
 * @returns Formatted percentage string (e.g., "25.00%")
 */
export const formatPercent = (value: number, fractionDigits = 2): string => {
  return `${(value * 100).toFixed(fractionDigits)}%`
}

/**
 * Format a number as percentage from a value that's already a percentage.
 * @param value - Numeric value already as percentage (e.g., 25 for 25%)
 * @param fractionDigits - Number of decimal places (default: 1)
 * @returns Formatted percentage string (e.g., "25.0%")
 */
export const formatPercentValue = (
  value: number,
  fractionDigits = 1,
): string => {
  return `${value.toFixed(fractionDigits)}%`
}

/** A date with no time component, e.g. "2026-08-04". */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Format a date string for display.
 *
 * Date-only strings are rendered as the calendar date they name, not shifted into the
 * viewer's timezone. `new Date("2026-08-04")` is midnight *UTC*, so west of UTC it
 * renders as the 3rd — a "last checked" or "as at" date silently reported a day early
 * for anyone in the Americas. Values that carry a time are left alone; converting those
 * to local time is correct.
 *
 * @param dateString - ISO date string
 * @param options - Intl.DateTimeFormatOptions (optional)
 * @returns Formatted date string (e.g., "Jan 15, 2024")
 */
export const formatDate = (
  dateString: string,
  options?: Intl.DateTimeFormatOptions,
): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
  const resolved = options || defaultOptions
  // Pin only when the caller has not asked for a specific zone - an explicit
  // timeZone is a deliberate request and must win.
  const pinToUtc = DATE_ONLY.test(dateString) && !resolved.timeZone
  return new Date(dateString).toLocaleDateString(
    undefined,
    pinToUtc ? { ...resolved, timeZone: "UTC" } : resolved,
  )
}

/**
 * Format a date string with time.
 * @param dateString - ISO date string
 * @returns Formatted date/time string (e.g., "Jan 15, 2024, 3:45 PM")
 */
export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Format a number as currency with a symbol prefix using locale-aware formatting.
 * Identical contract to the former independence/formatters formatCurrency.
 * @param value - Numeric value to format
 * @param symbol - Currency symbol prefix (default: '$')
 * @returns Formatted currency string (e.g., "$1,234.5")
 */
export const formatCurrencySymbol = (value: number, symbol = "$"): string =>
  `${symbol}${value.toLocaleString()}`

/**
 * Symbols for the currencies svc-data cannot disambiguate: it serves a bare
 * "$" for every member of the dollar family alike. The display-currency
 * overlay puts two amounts side by side, and "S$4,200 ≈ $5,460" reads as
 * though nothing was converted — so these are spelled out locally.
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  NZD: "NZ$",
  SGD: "S$",
  AUD: "A$",
  CAD: "C$",
  USD: "$",
  GBP: "£",
  EUR: "€",
  JPY: "¥",
}

/**
 * Display symbol for a currency code.
 * @param currency - ISO currency code (e.g. "NZD")
 * @param backendSymbol - Symbol as served by svc-data, used for any currency
 *   the local map doesn't need to disambiguate (MYR, THB, …). The map still
 *   wins for the dollar family, where the backend's "$" is the problem.
 * @returns Symbol prefix (e.g. "NZ$")
 */
export const currencySymbolFor = (
  currency: string | undefined,
  backendSymbol?: string,
): string => (currency && CURRENCY_SYMBOLS[currency]) || backendSymbol || "$"

/**
 * Compact money, for headline figures and chart axes.
 *
 * Takes a currency code rather than assuming dollars: a plan held in SGD was
 * previously charted as "$2.14M", which reads as USD and understates the
 * number by a third. Magnitudes round to two significant-ish digits because
 * these are projections — "S$2.14M" claims precision the model doesn't have,
 * but it is the established scale on this surface, so keep 2dp at millions
 * and drop the decimal at thousands.
 *
 * @param value - Numeric value
 * @param currency - ISO currency code (e.g. "SGD"). Omit for a bare "$".
 * @returns Compact string (e.g. "S$2.14M", "NZ$180K", "£950")
 */
export const formatCompact = (value: number, currency?: string): string => {
  const symbol = currencySymbolFor(currency)
  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)
  if (abs >= 1_000_000 || roundsIntoMillions(abs)) {
    return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`
  }
  if (abs >= 1_000) return `${sign}${symbol}${Math.round(abs / 1_000)}K`
  return `${sign}${symbol}${Math.round(abs).toLocaleString()}`
}

/**
 * True when rounding to whole thousands would read as "1000K".
 *
 * 999,999 / 1,000 is 999.999, which rounds to 1000 — so the naive form printed
 * "$1000K", a figure the reader has to divide by a thousand to understand.
 * Anything that rounds that far has reached the millions scale.
 */
const roundsIntoMillions = (abs: number): boolean =>
  abs >= 1_000 && Math.round(abs / 1_000) >= 1_000

/**
 * Compact money without the currency symbol — for chart axis ticks, where the
 * symbol repeats on every gridline and earns nothing.
 */
export const formatCompactBare = (value: number): string => {
  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)
  if (abs >= 1_000_000 || roundsIntoMillions(abs)) {
    return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  }
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K`
  return `${sign}${Math.round(abs)}`
}

/**
 * Format a number with sign prefix for display.
 * @param value - Numeric value
 * @param fractionDigits - Number of decimal places (default: 2)
 * @returns Formatted string with sign (e.g., "+1,234.56" or "-1,234.56")
 */
export const formatSignedNumber = (
  value: number,
  fractionDigits = 2,
): string => {
  const formatted = formatCurrency(Math.abs(value), fractionDigits)
  return value >= 0 ? `+${formatted}` : `-${formatted}`
}

/**
 * Returns today's date as a YYYY-MM-DD string (ISO 8601 date part), in the
 * *local* calendar, not UTC.
 *
 * `toISOString()` would yield the UTC calendar date, which is a day behind for
 * zones ahead of UTC (Asia/Singapore, UTC+8, between 00:00 and 08:00 local) and
 * a day ahead for zones behind it. Callers use this to seed trade/price dates,
 * which the backend resolves against its own configured zone — so an off-by-one
 * lands the row on the wrong day.
 */
export const todayIso = (): string => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Extracts a readable message from an unknown error value.
 * @param err - The caught error (any type)
 * @param fallback - Fallback string when err is not an Error instance
 */
export function toErrorMessage(
  err: unknown,
  fallback = "Unknown error",
): string {
  return err instanceof Error ? err.message : fallback
}

/**
 * Returns a Tailwind text-colour class for a gain/loss value.
 * Zero is treated as a gain (green).
 * @param value - Numeric gain/loss value
 */
export function gainLossClass(value: number): string {
  return value >= 0 ? "text-green-600" : "text-red-600"
}
