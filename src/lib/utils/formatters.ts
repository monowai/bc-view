/**
 * Shared formatting utilities for currency, percentage, and date display.
 */

/**
 * Format a number as currency with locale-aware formatting.
 * @param value - Numeric value to format
 * @param fractionDigits - Number of decimal places (default: 2)
 * @returns Formatted currency string (e.g., "1,234.56")
 */
export const formatCurrency = (
  value: number,
  fractionDigits = 2
): string => {
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
export const formatPercent = (
  value: number,
  fractionDigits = 2
): string => {
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
  fractionDigits = 1
): string => {
  return `${value.toFixed(fractionDigits)}%`
}

/**
 * Format a date string for display.
 * @param dateString - ISO date string
 * @param options - Intl.DateTimeFormatOptions (optional)
 * @returns Formatted date string (e.g., "Jan 15, 2024")
 */
export const formatDate = (
  dateString: string,
  options?: Intl.DateTimeFormatOptions
): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
  return new Date(dateString).toLocaleDateString(
    undefined,
    options || defaultOptions
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
 * Format a number with sign prefix for display.
 * @param value - Numeric value
 * @param fractionDigits - Number of decimal places (default: 2)
 * @returns Formatted string with sign (e.g., "+1,234.56" or "-1,234.56")
 */
export const formatSignedNumber = (
  value: number,
  fractionDigits = 2
): string => {
  const formatted = formatCurrency(Math.abs(value), fractionDigits)
  return value >= 0 ? `+${formatted}` : `-${formatted}`
}
