import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  ExpenseFormEntry,
  LifestyleCategory,
  TierSelectionChange,
} from "types/independence"
import {
  boardMonthlyTotal,
  fitToBudget,
  isCustomAmount,
  lifestyleHeadline,
  nearestTierIndex,
} from "@lib/independence/lifestyleBoard"
import InfoTooltip from "@components/ui/Tooltip"

interface LifestyleMoodBoardProps {
  categories: LifestyleCategory[]
  currency: string
  expenses: ExpenseFormEntry[]
  /**
   * Expense rows snapshotted once, at Expenses-step mount, before the
   * board seeds any rows back into the form. Powers the "you today" chip,
   * the nearest-tier highlight and the header delta so they stay fixed
   * for the rest of the session instead of drifting once the board writes
   * its own picks into the live `expenses` prop. Falls back to `expenses`
   * when the caller doesn't supply one (e.g. standalone component tests).
   */
  expensesSnapshot?: ExpenseFormEntry[]
  onSelectionChange: (change: TierSelectionChange) => void
}

type Mode = "budget" | "board"

const MIN_BUDGET = 1000
const MAX_BUDGET = 32000
const BUDGET_STEP = 100

const currencySymbol = (currency: string): string => {
  switch (currency) {
    case "USD":
      return "$"
    case "SGD":
      return "S$"
    case "EUR":
      return "€"
    default:
      return "$"
  }
}

/** Sum of monthlyAmount across all rows matching a categoryLabelId. */
function existingAmountFor(
  categoryLabelId: string,
  expenses: ExpenseFormEntry[],
): number {
  return expenses
    .filter((e) => e.categoryLabelId === categoryLabelId)
    .reduce((sum, e) => sum + (e.monthlyAmount || 0), 0)
}

export default function LifestyleMoodBoard({
  categories,
  currency,
  expenses,
  expensesSnapshot,
  onSelectionChange,
}: LifestyleMoodBoardProps): React.ReactElement {
  const anchorExpenses = expensesSnapshot ?? expenses

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  )

  const hasInitialized = useRef(false)

  const [mode, setMode] = useState<Mode>("budget")
  const [budget, setBudget] = useState<number>(8000)
  const [selection, setSelection] = useState<Record<string, number>>({})
  const [pickedKeys, setPickedKeys] = useState<Set<string>>(new Set())

  const symbol = currencySymbol(currency)

  // Seed the board from existing expense values on mount: each category
  // starts at its nearest tier match to the existing amount (if any),
  // without marking it "picked" — that only happens on explicit board
  // interaction.
  useEffect(() => {
    if (hasInitialized.current || sortedCategories.length === 0) return
    hasInitialized.current = true

    const seeded: Record<string, number> = {}
    sortedCategories.forEach((c) => {
      const existing = existingAmountFor(c.categoryLabelId, expenses)
      seeded[c.key] = existing > 0 ? nearestTierIndex(existing, c.tiers) : 0
    })
    setSelection(seeded)
    const total = boardMonthlyTotal(sortedCategories, seeded)
    setBudget(Math.max(MIN_BUDGET, Math.min(MAX_BUDGET, total || 8000)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedCategories])

  const emitChange = (
    nextSelection: Record<string, number>,
    nextPicked: Set<string>,
  ): void => {
    onSelectionChange({
      selection: nextSelection,
      pickedKeys: Array.from(nextPicked),
    })
  }

  const handleBudgetChange = (value: number): void => {
    setBudget(value)
    setMode("budget")
    const fitted = fitToBudget(sortedCategories, value)
    setSelection(fitted)
    const nextPicked = new Set(sortedCategories.map((c) => c.key))
    setPickedKeys(nextPicked)
    emitChange(fitted, nextPicked)
  }

  const handleTierClick = (
    category: LifestyleCategory,
    tierIndex: number,
  ): void => {
    setMode("board")
    const nextSelection = { ...selection, [category.key]: tierIndex }
    const nextPicked = new Set(pickedKeys)
    nextPicked.add(category.key)
    setSelection(nextSelection)
    setPickedKeys(nextPicked)
    emitChange(nextSelection, nextPicked)
  }

  const boardTotal = boardMonthlyTotal(sortedCategories, selection)
  const existingTotal = sortedCategories.reduce(
    (sum, c) => sum + existingAmountFor(c.categoryLabelId, anchorExpenses),
    0,
  )
  const hasExisting = existingTotal > 0
  const delta = boardTotal - existingTotal
  const headline = lifestyleHeadline(boardTotal)

  return (
    <div className="space-y-5" data-testid="lifestyle-mood-board">
      <div className="rounded-xl border border-independence-200 bg-independence-50 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-independence-700">
              This board reads as a{" "}
              <span className="font-bold">{headline}</span> retirement
            </p>
            {hasExisting && (
              <p className="mt-1 text-xs text-independence-600">
                Board is {symbol}
                {Math.abs(delta).toLocaleString()}/mo{" "}
                {delta >= 0 ? "above" : "below"} your current spend{" "}
                <InfoTooltip text="Compared against your current spend in board categories only — excludes Utilities and custom rows.">
                  <span className="sr-only">What is this delta?</span>
                </InfoTooltip>
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold tabular-nums text-independence-800">
              {symbol}
              {boardTotal.toLocaleString()}
              <span className="text-sm font-normal text-independence-500">
                {" "}
                /mo
              </span>
            </p>
            <p className="text-xs text-independence-500">
              {symbol}
              {(boardTotal * 12).toLocaleString()} /yr
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg bg-white border border-independence-200 p-0.5">
            <button
              type="button"
              onClick={() => setMode("budget")}
              className={`px-3 py-1.5 text-xs rounded-md font-medium ${
                mode === "budget"
                  ? "bg-independence-600 text-white"
                  : "text-independence-600"
              }`}
            >
              Budget → Board
            </button>
            <button
              type="button"
              onClick={() => setMode("board")}
              className={`px-3 py-1.5 text-xs rounded-md font-medium ${
                mode === "board"
                  ? "bg-independence-600 text-white"
                  : "text-independence-600"
              }`}
            >
              Board → Budget
            </button>
          </div>

          <div className="flex-1 min-w-[200px] flex items-center gap-2">
            <input
              type="range"
              aria-label="Monthly budget"
              min={MIN_BUDGET}
              max={MAX_BUDGET}
              step={BUDGET_STEP}
              value={budget}
              disabled={mode === "board"}
              onChange={(e) => handleBudgetChange(Number(e.target.value))}
              className="w-full"
            />
            <span className="text-xs tabular-nums text-independence-600 w-20 text-right">
              {symbol}
              {budget.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sortedCategories.map((category) => {
          const selectedIdx = selection[category.key] ?? 0
          const picked = pickedKeys.has(category.key)
          // "You today" chip + nearest-tier highlight read the frozen
          // snapshot so they don't drift once the board seeds its own
          // picks back into the live `expenses` prop.
          const anchorAmount = existingAmountFor(
            category.categoryLabelId,
            anchorExpenses,
          )
          const nearestIdx =
            anchorAmount > 0
              ? nearestTierIndex(anchorAmount, category.tiers)
              : null
          // Custom-chip detection stays on the live value — it reflects a
          // hand-edit made via the Detailed tab after a tier was picked.
          const liveAmount = existingAmountFor(
            category.categoryLabelId,
            expenses,
          )
          const isCustom =
            picked && isCustomAmount(liveAmount, category.tiers[selectedIdx])

          return (
            <div
              key={category.key}
              className="rounded-lg border border-gray-200 bg-white p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-sm font-semibold text-gray-900"
                  data-testid="lifestyle-category-name"
                >
                  {category.emoji} {category.displayName}
                </span>
                <div className="flex items-center gap-1.5">
                  {anchorAmount > 0 && (
                    <span className="text-[11px] text-gray-400">
                      now {symbol}
                      {anchorAmount.toLocaleString()}
                    </span>
                  )}
                  {isCustom && (
                    <span
                      data-testid={`lifestyle-chip-custom-${category.key}`}
                      className="text-xs bg-independence-100 text-independence-700 px-2 py-0.5 rounded-full"
                    >
                      Custom
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {category.tiers.map((tier, idx) => {
                  const active = idx === selectedIdx
                  const nearest = !picked && idx === nearestIdx
                  return (
                    <button
                      key={tier.label}
                      type="button"
                      data-testid={
                        tier.reserve
                          ? "lifestyle-tier-reserve"
                          : `lifestyle-tier-${category.key}-${idx}`
                      }
                      onClick={() => handleTierClick(category, idx)}
                      className={`flex items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                        active
                          ? "border-independence-500 bg-independence-50 text-independence-800"
                          : nearest
                            ? "border-dashed border-independence-300 bg-independence-50/50 text-gray-600"
                            : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      } ${tier.reserve ? "border-dashed border-amber-300" : ""}`}
                    >
                      <span>{tier.emoji}</span>
                      <span className="font-medium">{tier.label}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-gray-600">
                        {symbol}
                        {tier.monthlyAmount.toLocaleString()}
                      </span>
                      {tier.reserve && (
                        <span className="text-amber-500">✦</span>
                      )}
                      {nearest && (
                        <span
                          data-testid={`lifestyle-tier-nearest-${category.key}-${idx}`}
                          className="sr-only"
                        >
                          nearest
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {picked && mode === "board" && (
                <p className="text-xs text-gray-500">
                  {category.tiers[selectedIdx].description}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
