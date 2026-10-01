import type { IncomeBreakdown, PlanExpense } from "types/independence"
import { buildExpenseMix } from "./lifestyleSummary"

/**
 * One projected year's cash, as sources and uses — the data behind the
 * single-year Sankey drill-down.
 *
 * Every figure is read from the projection row as svc-retire sent it. The only
 * derived node is the balancing one: what the year's income could not cover
 * is drawn from the portfolio, and what it over-covered is surplus. That node
 * is flagged `residual` so the UI labels it as a balancing figure rather than
 * a backend number. Investment returns are left out: they are growth inside
 * the portfolio, not cash the year spends.
 *
 * Living expenses can be split across the stage's expense categories. The
 * engine inflates one total at one rate, so each category's share of that
 * total holds for every year of the stage: the split distributes the
 * backend's figure, it never derives a new one.
 */

/** The fields both single-plan and composite rows can carry. */
export interface FlowRow {
  incomeBreakdown?: IncomeBreakdown
  /** Single-plan rows. */
  inflationAdjustedExpenses?: number
  /** Composite rows. */
  expenses?: number
  unfundedExpense?: number
  withdrawalTaxPaid?: number | null
}

export type FlowNodeKind = "income" | "portfolio" | "shortfall" | "spending"

export interface FlowNode {
  key: string
  label: string
  value: number
  kind: FlowNodeKind
  /** True when the value balances the year rather than coming from the row. */
  residual: boolean
  /** The total this node is a share of, e.g. "Living expenses". */
  group?: string
}

/** One category's share of a stage's living expenses. */
export interface ExpenseShare {
  key: string
  label: string
  share: number
}

export interface YearFlows {
  sources: FlowNode[]
  uses: FlowNode[]
  /** Total cash through the year; sources and uses both sum to it. */
  total: number
}

/** Below this a flow is rounding noise, not money. */
const MIN_FLOW = 0.5

const INCOME_STREAMS: [keyof IncomeBreakdown, string][] = [
  ["workingIncome", "Salary"],
  ["pension", "Pension"],
  ["assetPensions", "Private Pension"],
  ["socialSecurity", "Govt Benefits"],
  ["rentalIncome", "Rental"],
  ["otherIncome", "Other income"],
  ["lumpSumPayout", "Lump Sum"],
  ["lifeEventIncome", "Life event income"],
]

function node(
  key: string,
  label: string,
  value: number,
  kind: FlowNodeKind,
  residual = false,
): FlowNode {
  return { key, label, value, kind, residual }
}

const LIVING_EXPENSES = "Living expenses"

const isFlow = (n: FlowNode): boolean => n.value >= MIN_FLOW

const sum = (nodes: FlowNode[]): number =>
  nodes.reduce((total, n) => total + n.value, 0)

export function buildYearFlows(
  row: FlowRow,
  expenseMix: ExpenseShare[] = [],
): YearFlows {
  const breakdown = row.incomeBreakdown
  const living = row.inflationAdjustedExpenses ?? row.expenses ?? 0

  const income = INCOME_STREAMS.map(([key, label]) =>
    node(key, label, Number(breakdown?.[key] ?? 0), "income"),
  ).filter(isFlow)

  const livingNodes =
    expenseMix.length > 0
      ? expenseMix.map((s, i) => ({
          ...node(
            `expense-${i}-${s.key}`,
            s.label,
            living * s.share,
            "spending",
          ),
          group: LIVING_EXPENSES,
        }))
      : [node("expenses", LIVING_EXPENSES, living, "spending")]

  const spending = [
    ...livingNodes,
    node(
      "lifeEventExpense",
      "Life event expense",
      breakdown?.lifeEventExpense ?? 0,
      "spending",
    ),
    node(
      "withdrawalTax",
      "Withdrawal tax",
      row.withdrawalTaxPaid ?? 0,
      "spending",
    ),
  ].filter(isFlow)

  const gap = sum(spending) - sum(income)
  const unfunded = Math.min(Math.max(row.unfundedExpense ?? 0, 0), gap)

  const sources = [
    ...income,
    node("portfolio", "From portfolio", gap - unfunded, "portfolio", true),
    node("shortfall", "Unfunded shortfall", unfunded, "shortfall"),
  ].filter(isFlow)

  const uses = [
    ...spending,
    node("surplus", "Surplus to portfolio", -gap, "portfolio", true),
  ].filter(isFlow)

  return { sources, uses, total: sum(sources) }
}

/**
 * The stage's retirement expense categories as shares of their total, largest
 * first, the tail rolled into "Everything else" exactly as the stage's
 * spending board groups it. Working-years expenses are left out: the engine's
 * living-expense figure is built from retirement categories only.
 */
export function expenseShares(
  expenses: PlanExpense[] | undefined,
  maxCategories = 5,
): ExpenseShare[] {
  const retirement = (expenses ?? []).filter(
    (e) => (e.expensePhase ?? "RETIREMENT") === "RETIREMENT",
  )
  const mix = buildExpenseMix({ expenses: retirement, maxCategories })
  if (!mix) return []
  return mix.categories.map((c) => ({
    key: c.isRollup ? "rollup" : c.categoryLabelId,
    label: c.categoryName,
    share: c.amount / mix.monthlyTotal,
  }))
}

/**
 * A stage's average year: every flow averaged over the stage's rows. Flows
 * add, so the average balances the same way each year does.
 */
export function typicalYear(rows: FlowRow[]): FlowRow {
  const n = rows.length || 1
  const mean = (pick: (row: FlowRow) => number | null | undefined): number =>
    rows.reduce((total, row) => total + (pick(row) ?? 0), 0) / n
  const stream = (key: keyof IncomeBreakdown): number =>
    mean((row) => row.incomeBreakdown?.[key] as number | undefined)

  return {
    expenses: mean((row) => row.inflationAdjustedExpenses ?? row.expenses),
    unfundedExpense: mean((row) => row.unfundedExpense),
    withdrawalTaxPaid: mean((row) => row.withdrawalTaxPaid),
    incomeBreakdown: {
      investmentReturns: stream("investmentReturns"),
      pension: stream("pension"),
      assetPensions: stream("assetPensions"),
      lumpSumPayout: stream("lumpSumPayout"),
      socialSecurity: stream("socialSecurity"),
      otherIncome: stream("otherIncome"),
      rentalIncome: stream("rentalIncome"),
      workingIncome: stream("workingIncome"),
      lifeEventIncome: stream("lifeEventIncome"),
      lifeEventExpense: stream("lifeEventExpense"),
      totalIncome: stream("totalIncome"),
    },
  }
}
