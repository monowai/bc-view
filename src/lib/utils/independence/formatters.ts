/**
 * Formatting utilities for currency and numeric display.
 */

/**
 * Format a number as currency with locale-aware formatting.
 * @param value - Numeric value to format
 * @param symbol - Currency symbol (default: '$')
 * @returns Formatted currency string (e.g., "$1,234")
 */
export const formatCurrency = (value: number, symbol = "$"): string =>
  `${symbol}${value.toLocaleString()}`

/**
 * Format a number as percentage.
 * @param value - Numeric value (already as percentage, e.g., 7 for 7%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string (e.g., "7.0%")
 */
export const formatPercent = (value: number, decimals = 1): string =>
  `${value.toFixed(decimals)}%`
