import type { PlanExpense, SpendEntry } from "types/independence"
import { localIsoDate } from "@lib/formatters"

export const MONTHS_PER_YEAR = 12

/** `YYYY-MM` for a date, in local time. */
export function monthOf(date: Date): string {
  return localIsoDate(date).slice(0, 7)
}

/** Local midnight on the first day of a `YYYY-MM` month, `offset` months on. */
export function monthStart(month: string, offset = 0): Date {
  const [y, m] = month.split("-").map(Number)
  return new Date(y, m - 1 + offset, 1)
}

/** Signed whole-unit money with a currency symbol, as the spend views show it. */
export function formatSpendMoney(n: number, currencySymbol: string): string {
  return `${n < 0 ? "-" : ""}${currencySymbol}${Math.abs(Math.round(n)).toLocaleString()}`
}

/** A plan's monthly budget by category: its retirement-phase expenses only. */
export function retirementBudgets(
  expenses: PlanExpense[] | undefined,
): Record<string, number> {
  return Object.fromEntries(
    (expenses ?? [])
      .filter((e) => e.expensePhase !== "WORKING")
      .map((e) => [e.categoryLabelId, e.monthlyAmount]),
  )
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
  /** Of those, months svc-retire estimated because the user left them unrecorded. */
  monthsEstimated: number
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
  const typed = new Set<string>()
  let actual = 0
  let budget = 0
  for (const e of entries) {
    if (e.actual == null || !inWindow.has(e.month)) continue
    months.add(e.month)
    if (!e.estimated) typed.add(e.month)
    actual += e.actual
    budget += budgets[e.categoryLabelId] ?? 0
  }
  const monthsEntered = months.size
  if (monthsEntered === 0) return null
  const monthsEstimated = monthsEntered - typed.size
  const annualDraw = Math.max(
    plannedAnnualDraw + ((actual - budget) * MONTHS_PER_YEAR) / monthsEntered,
    0,
  )
  return { monthsEntered, monthsEstimated, actual, budget, annualDraw }
}
