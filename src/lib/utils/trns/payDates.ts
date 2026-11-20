/**
 * Monthly pay dates for a recurring payslip, on ISO `yyyy-MM-dd` strings. A
 * payslip falls on its pay day, or on the month's last day when the month is
 * shorter; the pay day itself is kept, so a clamped February does not move
 * March. Mirrors svc-data's `PayDates`.
 */

/** The day of month of an ISO date; 0 when the date is empty or invalid. */
export const payDay = (isoDate: string): number =>
  Number(isoDate.split("-")[2]) || 0

/** The pay date in the month after `isoDate`, on `day` clamped to that month. */
export function nextPayDate(isoDate: string, day: number): string {
  const [year, month] = isoDate.split("-").map(Number)
  // Month index `month` (0-based) is the following month; day 0 of the month
  // after that is its last day.
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const next = new Date(Date.UTC(year, month, Math.min(day, lastDay)))
  return next.toISOString().slice(0, "yyyy-MM-dd".length)
}
