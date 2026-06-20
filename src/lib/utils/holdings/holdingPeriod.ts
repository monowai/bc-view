/**
 * Shared helpers for "how long has this position been held" — derived from a
 * position's open date (`dateValues.opened`). Used by the holdings table and
 * card views via the AlphaProgress "alpha bar" so the period label and its
 * tooltip stay consistent across both.
 *
 * `now` is injectable to keep the formatting deterministic in tests.
 */
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000

/**
 * Elapsed years since `fromDate`, or undefined when no open date is known.
 */
export function holdingYears(
  fromDate?: string,
  now: Date = new Date(),
): number | undefined {
  if (!fromDate) return undefined
  const openDate = new Date(fromDate)
  if (Number.isNaN(openDate.getTime())) return undefined
  return (now.getTime() - openDate.getTime()) / YEAR_MS
}

/**
 * Compact holding-period label: whole months under a year (e.g. "5m"),
 * one-decimal years from a year and over (e.g. "2.5y"). Empty string when the
 * open date is unknown.
 */
export function formatHoldingPeriod(
  fromDate?: string,
  now: Date = new Date(),
): string {
  const years = holdingYears(fromDate, now)
  if (years === undefined) return ""
  if (years < 1) {
    const months = Math.floor(years * 12)
    return `${months}m`
  }
  return `${years.toFixed(1)}y`
}
