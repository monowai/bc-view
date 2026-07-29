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
import { useCompositeProjectionContext } from "../CompositeProjectionContext"
import { compositeOutlook } from "@lib/independence/compositeOutlook"
import type { CompositePhaseInfo } from "types/independence"

/**
 * The shape of spending through each phase of a composite plan.
 *
 * Deliberately shows what each phase COSTS, not what it supports. A composite
 * projection returns no sustainable-spend figure, and the obvious shortcut —
 * borrowing one phase's single-plan sustainable number — answers a different
 * question ("if this phase were your whole retirement…") and would read as an
 * affordability claim the backend never made. Whether the composite as a whole
 * holds up is already answered by the sustainability badge in the tab bar.
 */
export default function SummaryTab(): React.ReactElement {
  const { projection, isLoading } = useCompositeProjectionContext()
  const phases = projection?.phases ?? []

  if (isLoading && phases.length === 0) {
    return (
      <div className="py-12 flex justify-center">
        <Spinner label="Building your phases…" size="lg" />
      </div>
    )
  }

  if (phases.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-600 shadow-sm">
        No phases yet. Create one and this will show how your spending changes
        across each stage of your independence.
      </div>
    )
  }

  const outlook = compositeOutlook(projection)

  return (
    <div className="space-y-4">
      {/* The only affordability claim a composite can honestly make: the
          projection returns no sustainable-spend figure to scale the phase
          breakdowns against, but it does know whether the money lasts. */}
      {outlook && (
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">
            Your phases, together
          </h3>
          <p
            className={`mt-1 flex items-center gap-2 text-sm ${
              outlook.sustainable ? "text-green-700" : "text-amber-800"
            }`}
          >
            <i
              aria-hidden="true"
              className={`fas ${
                outlook.sustainable
                  ? "fa-check-circle"
                  : "fa-exclamation-triangle"
              }`}
            />
            {outlook.statement}
          </p>
        </div>
      )}
      <p className="text-sm text-gray-600">
        How your spending changes shape across each phase.
      </p>
      {phases.map((phase) => (
        <PhaseSpend key={`${phase.planId}-${phase.fromAge}`} phase={phase} />
      ))}
    </div>
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
  const mix = buildExpenseMix({
    expenses,
    labels,
    catalog,
  })

  // A phase with no expenses still renders: it's in the timeline, so it belongs
  // in the summary, and its empty board is exactly where the edit link needs to
  // be reachable. LifestyleSummary carries the teaching empty message.
  return (
    <LifestyleSummary
      model={mix}
      title={`${phase.planName} · age ${phase.fromAge}–${phase.toAge}`}
      currencySymbol={currencySymbolFor(phase.expensesCurrency)}
      hideValues={hideValues}
      isLoading={isLoading && !mix}
      emptyMessage={`Add what you expect to spend from age ${phase.fromAge} and we'll show the life this phase supports.`}
      action={
        <Link
          // Straight to Expenses: this board is about what the phase spends,
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
