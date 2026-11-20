import React, { useState } from "react"
import Dialog from "@components/ui/Dialog"
import MathInput from "@components/ui/MathInput"
import type { SpendDebit, SpendEntry } from "types/independence"
import { saveSpend } from "@utils/api/client/independence"
import SpendHistoryChart from "@components/features/wealth/SpendHistoryChart"
import {
  formatSpendMoney,
  monthOf,
  monthStart,
} from "@lib/independence/spendSummary"
import type {
  SpendAccount,
  SpendCategory,
} from "@components/features/wealth/useSpendLog"
import { useAccountPortfolios } from "@components/features/wealth/useAccountPortfolios"

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
  /** Bank accounts the month's actual total may be debited from. */
  accounts: SpendAccount[]
  /** Withdrawals already posted, one per debited month. */
  debits: SpendDebit[]
  onClose: () => void
  onSaved: () => void
}

interface RowValues {
  actual: number | null
}

/** Where a month's opening actuals came from. */
type MonthSource = "recorded" | "estimated" | "budget" | "none"

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

/**
 * A month's opening rows: what was recorded (or svc-retire estimated). A month
 * with nothing yet starts at the budget, so the user only changes what differs.
 */
function seedRows(
  categories: SpendCategory[],
  entries: SpendEntry[],
  month: string,
  budgets: Record<string, number>,
): Record<string, RowValues> {
  const rows: Record<string, RowValues> = {}
  // Once a month has figures, a category without one is unrecorded, not budget.
  const fromBudget = !entries.some((e) => e.month === month && e.actual != null)
  for (const c of categories) {
    const e = entries.find(
      (x) => x.month === month && x.categoryLabelId === c.categoryLabelId,
    )
    rows[c.categoryLabelId] = {
      actual:
        e?.actual ?? (fromBudget ? (budgets[c.categoryLabelId] ?? null) : null),
    }
  }
  return rows
}

function monthSource(
  entries: SpendEntry[],
  month: string,
  rows: Record<string, RowValues>,
): MonthSource {
  const actuals = entries.filter((e) => e.month === month && e.actual != null)
  if (actuals.some((e) => !e.estimated)) return "recorded"
  if (actuals.length > 0) return "estimated"
  return Object.values(rows).some((r) => r.actual != null) ? "budget" : "none"
}

/**
 * The account a month opens on: the one it was debited from, else the one
 * debited most recently, so a regular account carries forward month to month.
 */
function defaultAccount(
  debits: SpendDebit[],
  month: string,
  accounts: SpendAccount[],
): string {
  const latest = [...debits].sort((a, b) => b.month.localeCompare(a.month))[0]
  const id =
    debits.find((d) => d.month === month)?.cashAssetId ?? latest?.cashAssetId
  return accounts.some((a) => a.id === id) ? (id as string) : ""
}

type SpendTab = "month" | "history"

/**
 * Record a month's actual spend by category, set against the primary plan's
 * budget when there is one. Actuals start at the budget (or svc-retire's
 * estimate), so the user only changes what differs. One number per category per month, not a
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
  accounts,
  debits,
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
  // A budget in another currency cannot be set against the log.
  const otherCurrency = planCurrency !== null && planCurrency !== currency
  const budgets = otherCurrency ? {} : planBudgets
  const [categories] = useState(() => monthCategories(listed, entries, month))
  const [rows, setRows] = useState(() =>
    seedRows(categories, entries, month, budgets),
  )
  const [source] = useState(() => monthSource(entries, month, rows))
  const [saving, setSaving] = useState(false)
  const [accountId, setAccountId] = useState(() =>
    defaultAccount(debits, month, accounts),
  )
  const [portfolioPick, setPortfolioPick] = useState("")
  const holders = useAccountPortfolios(accountId)
  const monthDebit = debits.find(
    (d) => d.month === month && d.cashAssetId === accountId,
  )
  // Explicit pick, else where the month was posted before, else the first holder.
  const portfolioId =
    [portfolioPick, monthDebit?.portfolioId].find((id) =>
      holders.portfolios.some((p) => p.id === id),
    ) ??
    holders.portfolios[0]?.id ??
    ""
  const accountName = accounts.find((a) => a.id === accountId)?.name
  const debitBlocked =
    accountId !== "" && (holders.isLoading || portfolioId === "")
  const [error, setError] = useState<string | null>(null)

  const money = (n: number): string => formatSpendMoney(n, currencySymbol)
  /** An amount, or a dash when there is none. */
  const moneyOrDash = (n: number | null | undefined): string =>
    n == null ? "—" : money(n)
  const hasBudget = Object.keys(budgets).length > 0
  const sum = (pick: (r: RowValues) => number | null): number =>
    Object.values(rows).reduce((t, r) => t + (pick(r) ?? 0), 0)
  const totalBudget = categories.reduce(
    (t, c) => t + (budgets[c.categoryLabelId] ?? 0),
    0,
  )
  const totalActual = sum((r) => r.actual)
  // A blank category is unrecorded, not unspent: compare only what is filled in.
  const budgetRecorded = categories.reduce(
    (t, c) =>
      t +
      (rows[c.categoryLabelId].actual != null
        ? (budgets[c.categoryLabelId] ?? 0)
        : 0),
    0,
  )

  const setActual = (id: string, actual: number): void =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], actual } }))

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    const request = {
      currency,
      entries: categories
        .map((c) => ({
          categoryLabelId: c.categoryLabelId,
          categoryName: c.categoryName,
          actual: rows[c.categoryLabelId].actual,
        }))
        .filter((e) => e.actual != null),
      debit: accountId ? { portfolioId, cashAssetId: accountId } : null,
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
              disabled={
                categories.length === 0 || currency === "" || debitBlocked
              }
              variant="green"
            />
          )}
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 border-b border-gray-200">
        <div role="tablist" className="flex gap-4">
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
        {accounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 pb-2 text-sm">
            <label className="flex items-center gap-2 text-gray-700">
              Debit from
              <select
                aria-label="Debit from"
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value)
                  setPortfolioPick("")
                }}
                className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-independence-500"
              >
                <option value="">No account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {holders.portfolios.length > 1 && (
              <label className="flex items-center gap-2 text-gray-700">
                Portfolio
                <select
                  aria-label="Portfolio"
                  value={portfolioId}
                  onChange={(e) => setPortfolioPick(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-independence-500"
                >
                  {holders.portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </div>
      {accountId !== "" && !holders.isLoading && portfolioId === "" && (
        <p className="mb-3 text-sm text-loss">
          {accountName} is not held in a portfolio, so it cannot be debited.
        </p>
      )}
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
          {source === "estimated" && (
            <p className="mb-3 text-sm text-gray-600">
              Estimated — change what differs, then save to record it
            </p>
          )}
          {source === "budget" && (
            <p className="mb-3 text-sm text-gray-600">
              From your budget — change what differs, then save to record it
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
                    {moneyOrDash(budgets[b.categoryLabelId])}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <MathInput
                      aria-label={`${b.categoryName} actual`}
                      className={INPUT_CLS}
                      value={rows[b.categoryLabelId].actual ?? ""}
                      onChange={(n) => setActual(b.categoryLabelId, n)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <tr>
                <td className="px-3 py-2 text-gray-900">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {moneyOrDash(hasBudget ? totalBudget : null)}
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
                    colSpan={2}
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
        </>
      )}
    </Dialog>
  )
}
