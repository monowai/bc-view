import React from "react"
import Link from "next/link"
import LifestyleSummary from "@components/features/independence/LifestyleSummary"
import { usePlanExpenses } from "@components/features/independence/usePlanExpenses"
import { useExpenseCategories } from "@components/features/independence/useExpenseCategories"
import { useLifestyleCatalog } from "@components/features/independence/useLifestyleCatalog"
import { buildExpenseMix } from "@lib/independence/lifestyleSummary"
import { currencySymbolFor } from "@lib/formatters"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import Spinner from "@components/ui/Spinner"
import { useCompositeProjectionContext } from "./CompositeProjectionContext"
import type { CompositePhaseInfo } from "types/independence"

/**
 * What each stage of the plan actually costs.
 *
 * Deliberately shows what a phase COSTS, not what it supports. A composite
 * projection returns no sustainable-spend figure, and borrowing one phase's
 * single-plan number would answer a different question ("if this phase were
 * your whole retirement…") and read as an affordability claim the backend
 * never made. Whether it all holds together is answered once, at the top of
 * the page, by the verdict.
 */
export default function PhaseSpendList(): React.ReactElement | null {
  const { projection, isLoading } = useCompositeProjectionContext()
  const phases = projection?.phases ?? []

  if (isLoading && phases.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Building your stages…" size="lg" />
      </div>
    )
  }

  if (phases.length === 0) return null

  return (
    <section aria-labelledby="phase-spend-heading">
      <h2
        id="phase-spend-heading"
        className="text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        What this buys you
      </h2>
      <p className="mt-0.5 max-w-prose text-sm text-gray-600 dark:text-gray-400">
        How your spending changes shape through each stage of the plan.
      </p>
      <div className="mt-4 space-y-4">
        {phases.map((phase) => (
          <PhaseSpend key={`${phase.planId}-${phase.fromAge}`} phase={phase} />
        ))}
      </div>
    </section>
  )
}

function PhaseSpend({
  phase,
}: {
  phase: CompositePhaseInfo
}): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const { expenses, isLoading } = usePlanExpenses(phase.planId)
  const { labels } = useExpenseCategories()
  const { catalog } = useLifestyleCatalog(phase.expensesCurrency)
  const mix = buildExpenseMix({ expenses, labels, catalog })

  // A stage with no expenses still renders: it's in the timeline, so it
  // belongs here, and its empty board is exactly where the edit link needs to
  // be reachable. LifestyleSummary carries the teaching empty message.
  return (
    <LifestyleSummary
      model={mix}
      title={`${phase.planName} · age ${phase.fromAge}–${phase.toAge}`}
      currencySymbol={currencySymbolFor(phase.expensesCurrency)}
      hideValues={hideValues}
      isLoading={isLoading && !mix}
      emptyMessage={`Add what you expect to spend from age ${phase.fromAge} and we'll show the life this stage supports.`}
      action={
        <Link
          // Straight to Expenses: this board is about what the stage spends,
          // so that's the part of the wizard the user came to change.
          href={`/independence/wizard/${phase.planId}?step=expenses`}
          aria-label={`Edit ${phase.planName}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-1 focus:ring-independence-500 motion-reduce:transition-none dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <i aria-hidden="true" className="fas fa-pen text-[10px]" />
          Edit
        </Link>
      }
    />
  )
}
