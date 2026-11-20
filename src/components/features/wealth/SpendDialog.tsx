import React, { useState } from "react"
import Dialog from "@components/ui/Dialog"
import type { SpendEntry } from "types/independence"
import { saveSpend } from "@utils/api/client/independence"
import SpendHistoryChart from "@components/features/wealth/SpendHistoryChart"
import {
  formatSpendMoney,
  monthOf,
  monthStart,
} from "@lib/independence/spendSummary"
import type { SpendCategory } from "@components/features/wealth/useSpendLog"

interface SpendDialogProps {
  /** The user's expense categories: one row each. */
  categories: SpendCategory[]
  /** The plan's monthly budget by category; empty when there is no plan. */
  budgets: Record<string, number>
  /** Spend already recorded, any months. */
  entries: SpendEntry[]
  /** The currency spend is recorded in. */
  currency: string
  currencySymbol: string
  /** `YYYY-MM` to open on. */
  initialMonth: string
  /** `YYYY-MM`, oldest first: the months the History tab charts. */
  historyMonths: string[]
  /** The budget's currency; a budget in another currency is not compared. */
  planCurrency: string | null
  /** The plan's expenses failed to load. */
  budgetsUnavailable: boolean
  /** The expense categories failed to load. */
  categoriesUnavailable: boolean
  onClose: () => void
  onSaved: () => void
}

interface RowValues {
  projected: string
  actual: string
  /** svc-retire's estimate for an unrecorded month, shown as a placeholder. */
  estimate: string
}

const INPUT_CLS =
  "w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-independence-500"

function shiftMonth(month: string, delta: number): string {
  return monthOf(monthStart(month, delta))
}

function monthLabel(month: string): string {
  return monthStart(month).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  })
}

const toNumber = (value: string): number | null =>
  value.trim() === "" ? null : Number(value)

/**
 * The month's rows: every listed category, then any category recorded for
 * the month that is no longer listed. A save replaces the whole month, so a
 * recorded category must stay on screen or the save would drop it.
 */
function monthCategories(
  categories: SpendCategory[],
  entries: SpendEntry[],
  month: string,
): SpendCategory[] {
  const listed = new Set(categories.map((c) => c.categoryLabelId))
  const recorded = entries
    .filter((e) => e.month === month && !listed.has(e.categoryLabelId))
    .map((e) => ({
      categoryLabelId: e.categoryLabelId,
      categoryName: e.categoryName,
    }))
  return [...categories, ...recorded]
}

function seedRows(
  categories: SpendCategory[],
  entries: SpendEntry[],
  month: string,
): Record<string, RowValues> {
  const rows: Record<string, RowValues> = {}
  for (const c of categories) {
    const e = entries.find(
      (x) => x.month === month && x.categoryLabelId === c.categoryLabelId,
    )
    rows[c.categoryLabelId] = {
      projected: e?.projected != null ? String(e.projected) : "",
      actual: e?.actual != null && !e.estimated ? String(e.actual) : "",
      estimate: e?.actual != null && e.estimated ? String(e.actual) : "",
    }
  }
  return rows
}

type SpendTab = "month" | "history"

/**
 * Record a month's spend by category: what the owner expects to spend
 * (projected) and what they did spend (actual), set against the primary
 * plan's budget when there is one. One number per category per month, not a
 * transaction log. The History tab charts the recorded months. The log is the
 * user's actual outgoings, not a plan's.
 */
export default function SpendDialog(
  props: SpendDialogProps,
): React.ReactElement {
  const [month, setMonth] = useState(props.initialMonth)
  const [tab, setTab] = useState<SpendTab>("month")
  // Keyed by month so each month starts from its own recorded figures.
  return (
    <SpendMonthForm
      key={month}
      {...props}
      month={month}
      onMonthChange={(delta) => setMonth(shiftMonth(month, delta))}
      tab={tab}
      onTabChange={setTab}
    />
  )
}

function SpendMonthForm({
  categories: listed,
  budgets: planBudgets,
  entries,
  currency,
  currencySymbol,
  month,
  onMonthChange,
  historyMonths,
  planCurrency,
  budgetsUnavailable,
  categoriesUnavailable,
  tab,
  onTabChange,
  onClose,
  onSaved,
}: SpendDialogProps & {
  month: string
  onMonthChange: (delta: number) => void
  tab: SpendTab
  onTabChange: (tab: SpendTab) => void
}): React.ReactElement {
  const [categories] = useState(() => monthCategories(listed, entries, month))
  const [rows, setRows] = useState(() => seedRows(categories, entries, month))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const money = (n: number): string => formatSpendMoney(n, currencySymbol)
  // A budget in another currency cannot be set against the log.
  const otherCurrency = planCurrency !== null && planCurrency !== currency
  const budgets = otherCurrency ? {} : planBudgets
  const hasBudget = Object.keys(budgets).length > 0
  const sum = (pick: (r: RowValues) => string): number =>
    Object.values(rows).reduce((t, r) => t + (toNumber(pick(r)) ?? 0), 0)
  const totalBudget = categories.reduce(
    (t, c) => t + (budgets[c.categoryLabelId] ?? 0),
    0,
  )
  const totalProjected = sum((r) => r.projected)
  const totalActual = sum((r) => r.actual)
  // A blank category is unrecorded, not unspent: compare only what is filled in.
  const budgetRecorded = categories.reduce(
    (t, c) =>
      t +
      (toNumber(rows[c.categoryLabelId].actual) != null
        ? (budgets[c.categoryLabelId] ?? 0)
        : 0),
    0,
  )

  const update = (id: string, field: keyof RowValues, value: string): void =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    const request = {
      currency,
      entries: categories
        .map((c) => ({
          categoryLabelId: c.categoryLabelId,
          categoryName: c.categoryName,
          projected: toNumber(rows[c.categoryLabelId].projected),
          actual: toNumber(rows[c.categoryLabelId].actual),
        }))
        .filter((e) => e.projected != null || e.actual != null),
    }
    const failed = `Could not save spend for ${monthLabel(month)}`
    try {
      const res = await saveSpend(month, request)
      if (res.ok) {
        onSaved()
      } else {
        // A refusal (400) carries the reason, such as the log's locked currency.
        const body: { message?: string } | null =
          res.status === 400 ? await res.json().catch(() => null) : null
        setError(body?.message || failed)
      }
    } catch {
      setError(failed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      title="Monthly Spend"
      onClose={onClose}
      maxWidth="2xl"
      scrollable
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label="Close" />
          {tab === "month" && (
            <Dialog.SubmitButton
              onClick={save}
              label="Save"
              loadingLabel="Saving…"
              isSubmitting={saving}
              disabled={categories.length === 0 || currency === ""}
              variant="green"
            />
          )}
        </>
      }
    >
      <div role="tablist" className="mb-3 flex gap-4 border-b border-gray-200">
        {(["month", "history"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => onTabChange(t)}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm ${tab === t ? "border-independence-500 font-medium text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t === "month" ? "Month" : "History"}
          </button>
        ))}
      </div>
      {tab === "history" ? (
        <SpendHistoryChart
          entries={entries}
          budgets={budgets}
          months={historyMonths}
          currencySymbol={currencySymbol}
        />
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => onMonthChange(-1)}
              className="rounded px-2 py-1 text-gray-600 hover:bg-gray-100"
            >
              <i className="fas fa-chevron-left" />
            </button>
            <span className="font-semibold text-gray-900">
              {monthLabel(month)}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => onMonthChange(1)}
              className="rounded px-2 py-1 text-gray-600 hover:bg-gray-100"
            >
              <i className="fas fa-chevron-right" />
            </button>
          </div>
          <Dialog.ErrorAlert message={error} />
          {Object.values(rows).some((r) => r.estimate) && (
            <p className="mb-3 text-sm text-gray-600">
              Estimated — enter what you spent to replace it
            </p>
          )}
          {otherCurrency && (
            <p className="mb-3 text-sm text-gray-600">
              Spend is logged in {currency}, so it is not compared with your
              plan&apos;s {planCurrency} budget.
            </p>
          )}
          {budgetsUnavailable && (
            <p className="mb-3 text-sm text-loss">
              Could not load your plan&apos;s budget. Try again later.
            </p>
          )}
          {categoriesUnavailable && (
            <p className="mb-3 text-sm text-loss">
              Could not load your expense categories. Try again later.
            </p>
          )}
          {categories.length === 0 && !categoriesUnavailable && (
            <p className="mb-3 text-sm text-gray-600">
              No expense categories yet.
            </p>
          )}
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Budget
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Projected
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Actual
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((b) => (
                <tr key={b.categoryLabelId}>
                  <td className="px-3 py-2 text-gray-900">{b.categoryName}</td>
                  <td
                    className="px-3 py-2 text-right tabular-nums text-gray-600"
                    data-testid={`budget-${b.categoryLabelId}`}
                  >
                    {budgets[b.categoryLabelId] == null
                      ? "—"
                      : money(budgets[b.categoryLabelId])}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      aria-label={`${b.categoryName} projected`}
                      className={INPUT_CLS}
                      value={rows[b.categoryLabelId].projected}
                      onChange={(e) =>
                        update(b.categoryLabelId, "projected", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      aria-label={`${b.categoryName} actual`}
                      className={INPUT_CLS}
                      value={rows[b.categoryLabelId].actual}
                      placeholder={
                        rows[b.categoryLabelId].estimate
                          ? `est. ${rows[b.categoryLabelId].estimate}`
                          : undefined
                      }
                      onChange={(e) =>
                        update(b.categoryLabelId, "actual", e.target.value)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <tr>
                <td className="px-3 py-2 text-gray-900">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {hasBudget ? money(totalBudget) : "—"}
                </td>
                <td
                  className="px-3 py-2 text-right tabular-nums"
                  data-testid="total-projected"
                >
                  {money(totalProjected)}
                </td>
                <td
                  className="px-3 py-2 text-right tabular-nums"
                  data-testid="total-actual"
                >
                  {money(totalActual)}
                </td>
              </tr>
              {hasBudget && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-2 text-gray-500 font-normal"
                  >
                    Actual against budget (categories filled in)
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${totalActual > budgetRecorded ? "text-loss" : "text-gain"}`}
                    data-testid="total-variance"
                  >
                    {money(totalActual - budgetRecorded)}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
          <p className="mt-3 text-xs text-gray-500">
            One figure per category per month. Leave a cell blank if you have
            nothing to record.
          </p>
        </>
      )}
    </Dialog>
  )
}
