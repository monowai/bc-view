import React, { useMemo } from "react"
import type { RetirementPlan } from "types/independence"
import { currencySymbolFor } from "@lib/formatters"
import { buildLifestyleSummary } from "@lib/independence/lifestyleSummary"
import { buildInsights } from "@lib/independence/report/buildReport"
import { phrases } from "@lib/independence/report/reportPhrases"
import type { AssetBreakdown } from "../useAssetBreakdown"
import { useFiProjectionSimple } from "../useUnifiedProjection"
import { usePlanExpenses } from "../usePlanExpenses"
import { useExpenseCategories } from "../useExpenseCategories"
import { useLifestyleCatalog } from "../useLifestyleCatalog"
import LifestyleSummary from "../LifestyleSummary"
import { FindingsList, maskMoney } from "./reportParts"

/**
 * One stage of the journey report: the stage plan projected on its own, for
 * the findings and lifestyle the composite projection does not carry. Each
 * stage owns its hooks, so the report renders one of these per stage.
 */
export interface JourneyStageInsightsProps {
  plan: RetirementPlan
  /** "Stage 2 · New Zealand · ages 70–79" */
  stageLabel: string
  assets: AssetBreakdown
  /** The journey's display currency, so stage figures read in one currency. */
  displayCurrency: string
  hideValues: boolean
}

export default function JourneyStageInsights({
  plan,
  stageLabel,
  assets,
  displayCurrency,
  hideValues,
}: JourneyStageInsightsProps): React.ReactElement {
  const { projection, isLoading, error } = useFiProjectionSimple({
    plan,
    assets,
    displayCurrency,
  })
  const { expenses } = usePlanExpenses(plan.id)
  const { labels } = useExpenseCategories()
  const { catalog } = useLifestyleCatalog(plan.expensesCurrency)
  const lifestyle = useMemo(
    () =>
      projection
        ? buildLifestyleSummary({ expenses, projection, labels, catalog })
        : null,
    [expenses, projection, labels, catalog],
  )
  const insights = useMemo(
    () => (projection ? buildInsights(projection) : null),
    [projection],
  )
  const sym = currencySymbolFor(displayCurrency)
  const m = (s: string): string => maskMoney(s, sym, hideValues)

  const body = (): React.ReactNode => {
    if (projection && insights) {
      return (
        <>
          <LifestyleSummary
            model={lifestyle}
            currencySymbol={sym}
            hideValues={hideValues}
            variant="panel"
            title="Lifestyle"
            emptyMessage="No expenses recorded for this stage."
          />
          {insights.empty ? (
            <p className="mt-2 text-gray-600">{insights.empty}</p>
          ) : (
            <FindingsList findings={insights.findings} mask={m} />
          )}
        </>
      )
    }
    if (error) {
      return (
        <p className="text-red-700">
          This stage could not be projected: {error.message}
        </p>
      )
    }
    if (isLoading) {
      return <p className="text-gray-600">Projecting this stage…</p>
    }
    return (
      <p className="text-gray-600">
        This stage has no assets to project on its own.
      </p>
    )
  }

  return (
    <div data-testid={`stage-${plan.id}`} className="report-keep py-3">
      <h3 className="text-sm font-semibold text-gray-900">{stageLabel}</h3>
      <p className="mb-2 text-xs text-gray-500">
        {phrases.JOURNEY_STAGE_STANDALONE()}
      </p>
      {body()}
    </div>
  )
}
