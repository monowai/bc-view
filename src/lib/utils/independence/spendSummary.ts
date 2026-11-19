import type { SpendEntry } from "types/independence"

export const MONTHS_PER_YEAR = 12

/** `YYYY-MM` for a date, in local time. */
export function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** The `count` months ending in the month of `today`, oldest first. */
export function trailingMonths(today: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    monthOf(
      new Date(today.getFullYear(), today.getMonth() - (count - 1 - i), 1),
    ),
  )
}

export interface SpendSummary {
  /** Months in the window with at least one actual recorded. */
  monthsEntered: number
  /** Actual spend over those months. */
  actual: number
  /**
   * Budget for the same months, counting each month only the categories that
   * have an actual: a blank category is unrecorded, not unspent.
   */
  budget: number
  /**
   * The planned annual draw, moved by the overspend (or underspend) against
   * budget, annualised. Spending over budget comes straight out of the pot.
   */
  annualDraw: number
}

/**
 * Sum recorded actual spend over the window and set it against the plan's
 * budget for the categories recorded. Null when no month in the window has
 * an actual yet.
 *
 * @param budgets monthly budget by category label id; a category with no
 *   budget counts as zero, so spending in it is all over budget.
 */
export function spendSummary(
  entries: SpendEntry[],
  budgets: Record<string, number>,
  plannedAnnualDraw: number,
  window: string[],
): SpendSummary | null {
  const inWindow = new Set(window)
  const months = new Set<string>()
  let actual = 0
  let budget = 0
  for (const e of entries) {
    if (e.actual == null || !inWindow.has(e.month)) continue
    months.add(e.month)
    actual += e.actual
    budget += budgets[e.categoryLabelId] ?? 0
  }
  const monthsEntered = months.size
  if (monthsEntered === 0) return null
  const annualDraw = Math.max(
    plannedAnnualDraw + ((actual - budget) * MONTHS_PER_YEAR) / monthsEntered,
    0,
  )
  return { monthsEntered, actual, budget, annualDraw }
}
