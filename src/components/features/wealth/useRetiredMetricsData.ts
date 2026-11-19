import { useState } from "react"
import useSwr from "swr"
import type {
  MonteCarloResponse,
  MonteCarloResult,
  PlanExpense,
  SpendEntry,
  SpendResponse,
  RetirementProjection,
} from "types/independence"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { investmentsKey, investmentsMonthlyKey } from "@utils/api/client/trns"
import {
  monteCarloUrl,
  spendKey,
  runMonteCarlo,
} from "@utils/api/client/independence"
import { usePlanExpenses } from "@components/features/independence/usePlanExpenses"
import { plannedAnnualDrawdown } from "@lib/independence/retiredMetrics"
import {
  MONTHS_PER_YEAR,
  type SpendSummary,
  spendSummary,
  trailingMonths,
} from "@lib/independence/spendSummary"

/** Fixed seed: the dashboard figure must not wobble between page loads. */
const DASHBOARD_SEED = 20261119

interface InvestmentWindow {
  totalInvested: number
}

interface RetiredMetricsData {
  drawnLastMonth: number | undefined
  drawnLastYear: number | undefined
  monteCarlo: MonteCarloResult | null
  monteCarloLoading: boolean
  /** The plan's retirement-phase expenses: the budget, by category. */
  budgets: PlanExpense[]
  /** Spend recorded over the history window. */
  spendEntries: SpendEntry[]
  spend: SpendSummary | null
  /** The month the spend log opens on, `YYYY-MM`. */
  currentMonth: string
  /** `YYYY-MM`, oldest first: the History tab's months. */
  historyMonths: string[]
  refreshSpend: () => void
  /** The spend log failed to load; the cards fall back to investment sales. */
  spendUnavailable: boolean
  /** The spend log's currency when it differs from the plan's; spend is then not compared. */
  spendOtherCurrency: string | null
}

const DAYS_PER_YEAR = 365
/** Months of spend history loaded for the chart; the summary uses the last 12. */
const HISTORY_MONTHS = 24

/** Net selling is a draw on the pot; net buying draws nothing. */
const drawn = (window: InvestmentWindow | undefined): number | undefined =>
  window === undefined ? undefined : Math.max(-window.totalInvested, 0)

/**
 * What the retired cards need beyond the projection: the net amount sold
 * from investments over 30 days and 12 months, and a seeded Monte Carlo run
 * of the plan on the same assets the projection used. Plus the monthly spend
 * log against the plan's budget, which outranks investment sales when present.
 */
export function useRetiredMetricsData(
  projection: RetirementProjection,
): RetiredMetricsData {
  const monthKey = investmentsMonthlyKey(projection.currency)
  const yearKey = investmentsKey(projection.currency, DAYS_PER_YEAR)
  const { data: month } = useSwr<InvestmentWindow>(
    monthKey,
    simpleFetcher(monthKey),
  )
  const { data: year } = useSwr<InvestmentWindow>(
    yearKey,
    simpleFetcher(yearKey),
  )

  const nonSpendableAssets = projection.totalAssets - projection.liquidAssets
  const { data: monteCarlo, isLoading: monteCarloLoading } =
    useSwr<MonteCarloResult | null>(
      [
        monteCarloUrl(projection.planId),
        projection.currency,
        projection.liquidAssets,
        nonSpendableAssets,
      ],
      async ([, currency, liquidAssets, nonSpendable]: [
        string,
        string,
        number,
        number,
      ]) => {
        const res = await runMonteCarlo(projection.planId, {
          currency,
          liquidAssets,
          nonSpendableAssets: nonSpendable,
          seed: DASHBOARD_SEED,
        })
        if (!res.ok) throw new Error("Failed to run Monte Carlo simulation")
        const body: MonteCarloResponse = await res.json()
        return body.data
      },
      { revalidateOnFocus: false },
    )

  // Fixed at mount: the window must not shift between renders.
  const [historyMonths] = useState(() =>
    trailingMonths(new Date(), HISTORY_MONTHS),
  )
  const window = historyMonths.slice(-MONTHS_PER_YEAR)
  const spendUrl = spendKey(
    historyMonths[0],
    historyMonths[historyMonths.length - 1],
  )
  const {
    data: spendData,
    error: spendError,
    mutate: mutateSpend,
  } = useSwr<SpendResponse>(spendUrl, simpleFetcher(spendUrl))
  const { expenses } = usePlanExpenses(projection.planId)
  const budgets = (expenses ?? []).filter((e) => e.expensePhase !== "WORKING")
  const budgetByCategory = Object.fromEntries(
    budgets.map((b) => [b.categoryLabelId, b.monthlyAmount]),
  )
  const spendEntries = spendData?.data ?? []
  // The service locks the log to its first currency; budgets are in the plan's.
  const logCurrency = spendEntries[0]?.currency ?? null
  const spendOtherCurrency =
    logCurrency !== null && logCurrency !== projection.currency
      ? logCurrency
      : null

  return {
    budgets,
    spendEntries,
    spendOtherCurrency,
    spend: spendSummary(
      spendOtherCurrency === null ? spendEntries : [],
      budgetByCategory,
      plannedAnnualDrawdown(projection),
      window,
    ),
    currentMonth: window[window.length - 1],
    historyMonths,
    refreshSpend: () => void mutateSpend(),
    spendUnavailable: spendError !== undefined,
    drawnLastMonth: drawn(month),
    drawnLastYear: drawn(year),
    monteCarlo: monteCarlo ?? null,
    monteCarloLoading,
  }
}
