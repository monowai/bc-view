import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import type { PlanExpense, PlanExpensesResponse } from "types/independence"

/**
 * The plan's expense mix by category. The plan record itself only carries the
 * monthly total, so anything that needs the breakdown — the lifestyle
 * summary — has to ask for it separately.
 */
export function usePlanExpenses(planId: string | undefined): {
  expenses: PlanExpense[] | undefined
  isLoading: boolean
} {
  const key = planId ? `/api/independence/plans/${planId}/expenses` : null
  const { data, isLoading } = useSwr<PlanExpensesResponse>(
    key,
    key ? simpleFetcher(key) : null,
  )
  return { expenses: data?.data, isLoading }
}
