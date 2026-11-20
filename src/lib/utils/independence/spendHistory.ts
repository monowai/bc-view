import type { SpendEntry } from "types/independence"

export const OTHER_KEY = "__other__"

/**
 * Categorical hues in fixed order (validated: CVD and normal-vision
 * separation pass on a light surface). Three sit under 3:1 contrast, so the
 * chart always ships a legend and a table view.
 */
const CATEGORY_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"]
const OTHER_COLOR = "#94a3b8"
/** The chart never shrinks below this many months. */
const MIN_MONTHS = 6
const THOUSAND = 1000

/** Axis tick: "1.5K", not a rounded "2K" that misplaces the gridline. */
export function formatSpendTick(n: number): string {
  if (Math.abs(n) < THOUSAND) return String(n)
  const k = n / THOUSAND
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
}

export interface SpendSeries {
  key: string
  name: string
  color: string
}

/** One month: actual by series key, plus totals. Null totals mean nothing recorded. */
export type SpendHistoryRow = {
  month: string
  actual: number | null
  budget: number | null
  projected: number | null
  /** Every actual this month was estimated by svc-retire. */
  estimated: boolean
} & Record<string, number | string | boolean | null>

export interface SpendHistory {
  series: SpendSeries[]
  rows: SpendHistoryRow[]
}

/**
 * Shape the spend log for a monthly stacked chart: the `maxSeries` largest
 * categories over the window, the rest folded into Other. Rows start at the
 * first recorded month (at least six months shown), so a new log is not a
 * mostly empty plot. Each month's budget
 * counts only the categories with an actual, as the spend summary does.
 */
export function spendHistory(
  entries: SpendEntry[],
  budgets: Record<string, number>,
  months: string[],
  maxSeries = CATEGORY_COLORS.length,
): SpendHistory {
  const inWindow = new Set(months)
  const recorded = entries.filter((e) => inWindow.has(e.month))

  const totals = new Map<string, { name: string; total: number }>()
  for (const e of recorded) {
    if (e.actual == null) continue
    const t = totals.get(e.categoryLabelId) ?? {
      name: e.categoryName,
      total: 0,
    }
    t.total += e.actual
    totals.set(e.categoryLabelId, t)
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1].total - a[1].total)
  // Each series needs a colour of its own: never more than the palette holds.
  const limit = Math.min(maxSeries, CATEGORY_COLORS.length)
  const top = ranked.slice(0, limit)
  const topKeys = new Set(top.map(([key]) => key))
  const series: SpendSeries[] = top.map(([key, t], i) => ({
    key,
    name: t.name,
    color: CATEGORY_COLORS[i],
  }))
  if (ranked.length > limit) {
    series.push({ key: OTHER_KEY, name: "Other", color: OTHER_COLOR })
  }

  const firstRecorded = months.findIndex((m) =>
    recorded.some((e) => e.month === m),
  )
  const start =
    firstRecorded < 0
      ? 0
      : Math.max(0, Math.min(firstRecorded, months.length - MIN_MONTHS))
  const rows = months.slice(start).map((month) => {
    const row: SpendHistoryRow = {
      month,
      actual: null,
      budget: null,
      projected: null,
      estimated: false,
    }
    let typedActual = false
    const add = (key: "actual" | "budget" | "projected", n: number): void => {
      row[key] = (row[key] ?? 0) + n
    }
    for (const e of recorded) {
      if (e.month !== month) continue
      if (e.projected != null) add("projected", e.projected)
      if (e.actual == null) continue
      add("actual", e.actual)
      if (!e.estimated) typedActual = true
      add("budget", budgets[e.categoryLabelId] ?? 0)
      const key = topKeys.has(e.categoryLabelId) ? e.categoryLabelId : OTHER_KEY
      row[key] = ((row[key] as number | undefined) ?? 0) + e.actual
    }
    row.estimated = row.actual != null && !typedActual
    return row
  })
  return { series, rows }
}
