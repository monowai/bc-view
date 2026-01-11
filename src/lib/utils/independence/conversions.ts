/**
 * Utilities for converting between percentage and decimal representations.
 * Backend stores values as decimals (e.g., 0.07 for 7%)
 * Frontend displays as percentages (e.g., 7 for 7%)
 */

/**
 * Convert decimal to percentage with precision handling.
 * @param decimal - Value as decimal (e.g., 0.07 for 7%)
 * @param defaultVal - Default decimal value if undefined
 * @returns Percentage value (e.g., 7 for 7%)
 */
export const toPercent = (
  decimal: number | undefined,
  defaultVal: number,
): number => Math.round((decimal ?? defaultVal) * 10000) / 100

/**
 * Convert percentage to decimal.
 * @param percent - Value as percentage (e.g., 7 for 7%)
 * @returns Decimal value (e.g., 0.07 for 7%)
 */
export const toDecimal = (percent: number): number => percent / 100

/**
 * Fields that require percentage/decimal conversion.
 * These fields are stored as decimals in the backend but displayed as percentages in the UI.
 */
export const PERCENTAGE_FIELDS = [
  "cashReturnRate",
  "equityReturnRate",
  "housingReturnRate",
  "inflationRate",
  "cashAllocation",
  "equityAllocation",
  "housingAllocation",
  "investmentAllocationPercent",
] as const

export type PercentageField = (typeof PERCENTAGE_FIELDS)[number]
