import type { SpendEntry } from "types/independence"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { usePrimaryPlan } from "@components/features/independence/usePrimaryPlan"
import { usePlanExpenses } from "@components/features/independence/usePlanExpenses"
import { useExpenseCategories } from "@components/features/independence/useExpenseCategories"
import { useSpendHistory } from "@components/features/wealth/useSpendHistory"
import { retirementBudgets } from "@lib/independence/spendSummary"

export interface SpendCategory {
  categoryLabelId: string
  categoryName: string
}

interface SpendLog {
  /** The user's expense categories, in their order: one row each. */
  categories: SpendCategory[]
  /** The primary plan's monthly budget by category; empty without a plan. */
  budgets: Record<string, number>
  entries: SpendEntry[]
  /** The currency spend is recorded in; null only with no currency anywhere. */
  currency: string | null
  /** The primary plan's expenses currency, or null without a plan. */
  planCurrency: string | null
  /** `YYYY-MM`, oldest first. */
  historyMonths: string[]
  isLoading: boolean
  budgetsUnavailable: boolean
  categoriesUnavailable: boolean
  refresh: () => void
}

/**
 * Everything the spend log needs, without a plan to start from. Spend is the
 * user's actual outgoings, so its rows are the user's expense categories; the
 * primary plan, when there is one, only supplies a budget to compare with.
 * The currency is the log's own once anything is recorded (svc-retire locks
 * it), else the plan's, else the user's reporting currency.
 */
export function useSpendLog(): SpendLog {
  const history = useSpendHistory()
  const {
    labels,
    isLoading: labelsLoading,
    error: labelsError,
  } = useExpenseCategories()
  const { primaryPlan, resolved } = usePrimaryPlan()
  const {
    expenses,
    isLoading: expensesLoading,
    error: expensesError,
  } = usePlanExpenses(primaryPlan?.id)
  const { preferences } = useUserPreferences()

  const planCurrency = primaryPlan?.expensesCurrency ?? null
  const categories = [...(labels ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => ({ categoryLabelId: l.id, categoryName: l.name }))

  return {
    categories,
    budgets: retirementBudgets(expenses),
    entries: history.entries,
    currency:
      history.entries[0]?.currency ??
      planCurrency ??
      preferences?.reportingCurrencyCode ??
      preferences?.baseCurrencyCode ??
      null,
    planCurrency,
    historyMonths: history.historyMonths,
    isLoading:
      history.isLoading ||
      labelsLoading ||
      !resolved ||
      (primaryPlan !== undefined && expensesLoading),
    budgetsUnavailable: expensesError !== undefined,
    categoriesUnavailable: labelsError !== undefined,
    refresh: history.refresh,
  }
}
