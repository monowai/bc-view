import useSwr from "swr"
import type {
  SpendAccountRef,
  SpendDebit,
  SpendEntry,
} from "types/independence"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { accountsKey } from "@utils/api/client/assets"
import { getAssetCurrency, toAssetArray } from "@lib/assets/assetUtils"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { usePrimaryPlan } from "@components/features/independence/usePrimaryPlan"
import { usePlanExpenses } from "@components/features/independence/usePlanExpenses"
import { useExpenseCategories } from "@components/features/independence/useExpenseCategories"
import { useSpendHistory } from "@components/features/wealth/useSpendHistory"
import { retirementBudgets } from "@lib/independence/spendSummary"

/** A private bank account the month's spend can be debited from. */
export interface SpendAccount {
  id: string
  name: string
}

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
  /** The bank withdrawals already posted, one per debited month. */
  debits: SpendDebit[]
  /** The account the user last chose to debit; null when none. */
  rememberedAccount: SpendAccountRef | null
  /** Private bank accounts in the spend currency: the only ones it may debit. */
  accounts: SpendAccount[]
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
  const { data: accountData, isLoading: accountsLoading } = useSwr<{
    data: unknown
  }>(accountsKey, simpleFetcher(accountsKey))

  const planCurrency = primaryPlan?.expensesCurrency ?? null
  const categories = [...(labels ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => ({ categoryLabelId: l.id, categoryName: l.name }))

  const currency =
    history.entries[0]?.currency ??
    planCurrency ??
    preferences?.reportingCurrencyCode ??
    preferences?.baseCurrencyCode ??
    null
  // No FX: the withdrawal must equal the recorded total.
  const accounts = toAssetArray(accountData?.data)
    .filter((a) => getAssetCurrency(a) === currency)
    .map((a) => ({ id: a.id, name: a.name || a.code }))

  return {
    categories,
    budgets: retirementBudgets(expenses),
    entries: history.entries,
    debits: history.debits,
    rememberedAccount: history.account,
    accounts,
    currency,
    planCurrency,
    historyMonths: history.historyMonths,
    isLoading:
      history.isLoading ||
      labelsLoading ||
      // The remembered account is chosen once, at open, from this list.
      Boolean(accountsLoading) ||
      !resolved ||
      (primaryPlan !== undefined && expensesLoading),
    budgetsUnavailable: expensesError !== undefined,
    categoriesUnavailable: labelsError !== undefined,
    refresh: history.refresh,
  }
}
