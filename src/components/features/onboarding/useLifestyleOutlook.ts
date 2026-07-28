import { useMemo } from "react"
import useSwr from "swr"
import { usePlanExpenses } from "@components/features/independence/usePlanExpenses"
import { useExpenseCategories } from "@components/features/independence/useExpenseCategories"
import { useLifestyleCatalog } from "@components/features/independence/useLifestyleCatalog"
import {
  buildLifestyleSummary,
  type LifestyleSummaryModel,
} from "@lib/independence/lifestyleSummary"
import type { ProjectionResponse } from "types/independence"

/**
 * The lifestyle read for the end of onboarding.
 *
 * Assets are deliberately omitted from the projection request: svc-retire
 * resolves them from the plan's linked portfolios, which the user has just
 * finished populating. Sending our own totals here would mean two places
 * deciding what the user owns.
 */
export function useLifestyleOutlook(
  planId: string | null | undefined,
  currency: string,
): { model: LifestyleSummaryModel | null; isLoading: boolean } {
  const { expenses, isLoading: expensesLoading } = usePlanExpenses(
    planId ?? undefined,
  )
  const { labels } = useExpenseCategories()
  const { catalog } = useLifestyleCatalog(currency)

  const url = planId ? `/api/independence/projection/${planId}` : null
  const { data, isLoading: projectionLoading } = useSwr<ProjectionResponse>(
    url ? [url, currency] : null,
    async () => {
      const res = await fetch(url!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      })
      if (!res.ok) throw new Error("Failed to fetch projection")
      return res.json()
    },
  )

  const model = useMemo(
    () =>
      buildLifestyleSummary({
        expenses,
        projection: data?.data,
        labels,
        catalog,
      }),
    [expenses, data, labels, catalog],
  )

  return { model, isLoading: expensesLoading || projectionLoading }
}
