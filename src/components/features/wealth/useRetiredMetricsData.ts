import useSwr from "swr"
import type { MonteCarloResponse, MonteCarloResult } from "types/independence"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { investmentsKey, investmentsMonthlyKey } from "@utils/api/client/trns"
import { usePlanExpenses } from "@components/features/independence/usePlanExpenses"
import { useSpendHistory } from "@components/features/wealth/useSpendHistory"
import type { RetiredBasis } from "@lib/independence/retiredBasis"
import {
  MONTHS_PER_YEAR,
  type SpendSummary,
  retirementBudgets,
  spendSummary,
} from "@lib/independence/spendSummary"

/** Fixed seed: the dashboard figure must not wobble between page loads. */
export const DASHBOARD_SEED = 20261119

interface InvestmentWindow {
  totalInvested: number
}

interface RetiredMetricsData {
  drawnLastMonth: number | undefined
  drawnLastYear: number | undefined
  monteCarlo: MonteCarloResult | null
  monteCarloLoading: boolean
  /** The Monte Carlo run failed. */
  monteCarloUnavailable: boolean
  spend: SpendSummary | null
  /** The spend log failed to load; the cards fall back to investment sales. */
  spendUnavailable: boolean
  /**
   * The spend log's currency when it is not both the budget's and the
   * basis's; spend is then not compared.
   */
  spendOtherCurrency: string | null
}

const DAYS_PER_YEAR = 365

/** Net selling is a draw on the pot; net buying draws nothing. */
const drawn = (window: InvestmentWindow | undefined): number | undefined =>
  window === undefined ? undefined : Math.max(-window.totalInvested, 0)

/**
 * What the retired cards need beyond their basis: the net amount sold from
 * investments over 30 days and 12 months, and a seeded Monte Carlo run of the
 * basis. Plus the monthly spend log against the current budget, which
 * outranks investment sales when present.
 */
export function useRetiredMetricsData(basis: RetiredBasis): RetiredMetricsData {
  const monthKey = investmentsMonthlyKey(basis.currency)
  const yearKey = investmentsKey(basis.currency, DAYS_PER_YEAR)
  const { data: month } = useSwr<InvestmentWindow>(
    monthKey,
    simpleFetcher(monthKey),
  )
  const { data: year } = useSwr<InvestmentWindow>(
    yearKey,
    simpleFetcher(yearKey),
  )

  const {
    data: monteCarlo,
    isLoading: monteCarloLoading,
    error: monteCarloError,
  } = useSwr<MonteCarloResult | null>(
    basis.monteCarloKey,
    async () => {
      const res = await basis.runMonteCarlo(DASHBOARD_SEED)
      if (!res.ok) throw new Error("Failed to run Monte Carlo simulation")
      const body: MonteCarloResponse = await res.json()
      return body.data
    },
    { revalidateOnFocus: false },
  )

  const history = useSpendHistory()
  const window = history.historyMonths.slice(-MONTHS_PER_YEAR)
  const { expenses } = usePlanExpenses(basis.budgetPlanId)
  const spendEntries = history.entries
  // The service locks the log to its first currency. Spend is set against the
  // budget, in the budget plan's currency, and its draw against liquid assets,
  // in the basis's: it is comparable only when the log is in both. A budget
  // whose currency is unknown is in neither. Nothing is converted here.
  const logCurrency = spendEntries[0]?.currency ?? null
  const comparable =
    logCurrency === basis.currency && logCurrency === basis.budgetCurrency
  const spendOtherCurrency =
    logCurrency !== null && !comparable ? logCurrency : null

  return {
    spendOtherCurrency,
    spend: spendSummary(
      spendOtherCurrency === null ? spendEntries : [],
      retirementBudgets(expenses),
      basis.plannedAnnualDraw,
      window,
    ),
    spendUnavailable: history.error !== undefined,
    // Investment sales are the fallback for no spend: withhold them until the
    // log has loaded, or the card shows sales and then flips to spend.
    drawnLastMonth: history.isLoading ? undefined : drawn(month),
    drawnLastYear: history.isLoading ? undefined : drawn(year),
    monteCarlo: monteCarlo ?? null,
    monteCarloLoading,
    monteCarloUnavailable: monteCarloError !== undefined,
  }
}
