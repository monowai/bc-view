import type { IncomeBreakdown } from "types/independence"

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

const isFlow = (n: FlowNode): boolean => n.value >= MIN_FLOW

const sum = (nodes: FlowNode[]): number =>
  nodes.reduce((total, n) => total + n.value, 0)

export function buildYearFlows(row: FlowRow): YearFlows {
  const breakdown = row.incomeBreakdown

  const income = INCOME_STREAMS.map(([key, label]) =>
    node(key, label, Number(breakdown?.[key] ?? 0), "income"),
  ).filter(isFlow)

  const spending = [
    node(
      "expenses",
      "Living expenses",
      row.inflationAdjustedExpenses ?? row.expenses ?? 0,
      "spending",
    ),
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
