import React, { useState } from "react"
import Dialog from "@components/ui/Dialog"
import type { PlanExpense, SpendEntry } from "types/independence"
import { saveSpend } from "@utils/api/client/independence"
import SpendHistoryChart from "@components/features/wealth/SpendHistoryChart"
import {
  formatSpendMoney,
  monthOf,
  monthStart,
} from "@lib/independence/spendSummary"

interface SpendDialogProps {
  /** The plan's retirement expenses: one row per category, with its budget. */
  budgets: PlanExpense[]
  /** Spend already recorded, any months. */
  entries: SpendEntry[]
  currency: string
  currencySymbol: string
  /** `YYYY-MM` to open on. */
  initialMonth: string
  /** `YYYY-MM`, oldest first: the months the History tab charts. */
  historyMonths: string[]
  /** The plan's expenses failed to load. */
  budgetsUnavailable: boolean
  /** The spend log's currency when it is not the plan's: not set against the budget. */
  spendOtherCurrency: string | null
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

function seedRows(
  budgets: PlanExpense[],
  entries: SpendEntry[],
  month: string,
): Record<string, RowValues> {
  const rows: Record<string, RowValues> = {}
  for (const b of budgets) {
    const e = entries.find(
      (x) => x.month === month && x.categoryLabelId === b.categoryLabelId,
    )
    rows[b.categoryLabelId] = {
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
 * (projected) and what they did spend (actual), against the plan's budget.
 * One number per category per month, not a transaction log. The History tab
 * charts the recorded months. The log is the user's, not the plan's.
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
  budgets,
  entries,
  currency,
  currencySymbol,
  month,
  onMonthChange,
  historyMonths,
  budgetsUnavailable,
  spendOtherCurrency,
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
  const [rows, setRows] = useState(() => seedRows(budgets, entries, month))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const money = (n: number): string => formatSpendMoney(n, currencySymbol)
  // Budgets are in the plan's currency; a log in another cannot be set against them.
  const comparable = spendOtherCurrency === null
  const sum = (pick: (r: RowValues) => string): number =>
    Object.values(rows).reduce((t, r) => t + (toNumber(pick(r)) ?? 0), 0)
  const totalBudget = budgets.reduce((t, b) => t + b.monthlyAmount, 0)
  const totalProjected = sum((r) => r.projected)
  const totalActual = sum((r) => r.actual)
  // A blank category is unrecorded, not unspent: compare only what is filled in.
  const budgetRecorded = budgets.reduce(
    (t, b) =>
      t +
      (toNumber(rows[b.categoryLabelId].actual) != null ? b.monthlyAmount : 0),
    0,
  )

  const update = (id: string, field: keyof RowValues, value: string): void =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    const request = {
      currency,
      entries: budgets
        .map((b) => ({
          categoryLabelId: b.categoryLabelId,
          categoryName: b.categoryName,
          projected: toNumber(rows[b.categoryLabelId].projected),
          actual: toNumber(rows[b.categoryLabelId].actual),
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
              disabled={budgets.length === 0}
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
          budgets={
            comparable
              ? Object.fromEntries(
                  budgets.map((b) => [b.categoryLabelId, b.monthlyAmount]),
                )
              : {}
          }
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
          {!comparable && (
            <p className="mb-3 text-sm text-gray-600">
              Spend is logged in {spendOtherCurrency}, so it is not compared
              with this plan&apos;s {currency} budget.
            </p>
          )}
          {budgetsUnavailable && (
            <p className="mb-3 text-sm text-loss">
              Could not load this plan&apos;s budget. Try again later.
            </p>
          )}
          {budgets.length === 0 && !budgetsUnavailable && (
            <p className="mb-3 text-sm text-gray-600">
              This plan has no retirement expenses yet. Add them in the plan to
              record spend against them.
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
              {budgets.map((b) => (
                <tr key={b.categoryLabelId}>
                  <td className="px-3 py-2 text-gray-900">{b.categoryName}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                    {money(b.monthlyAmount)}
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
                  {money(totalBudget)}
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
              {comparable && (
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
