/**
 * Period conversion utilities for annual/monthly input toggle.
 * All values are stored as monthly in the database - these utilities
 * convert for display purposes only.
 */

export type Period = "monthly" | "annual"

/**
 * Convert a monthly value to display value based on selected period.
 * @param monthlyValue - The stored monthly value
 * @param period - The display period
 * @returns The value for display (monthly unchanged, annual × 12)
 */
export function convertForDisplay(
  monthlyValue: number,
  period: Period,
): number {
  return period === "annual" ? monthlyValue * 12 : monthlyValue
}

/**
 * Convert a display value to monthly value for storage.
 * @param displayValue - The value entered by user
 * @param period - The period the user entered in
 * @returns The monthly value for storage (monthly unchanged, annual ÷ 12)
 */
export function convertForStorage(
  displayValue: number,
  period: Period,
): number {
  return period === "annual" ? displayValue / 12 : displayValue
}
