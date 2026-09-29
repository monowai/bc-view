import React, { useEffect, useMemo, useRef } from "react"
import type { RetirementPlan, RetirementProjection } from "types/independence"
import { buildLifestyleSummary } from "@lib/independence/lifestyleSummary"
import { reportSeed } from "@lib/independence/report/reportSeed"
import type { ReportAges } from "@lib/independence/report/buildReport"
import type { ScenarioState } from "../scenario/types"
import type { AssetBreakdown } from "../useAssetBreakdown"
import type { RentalIncomeData } from "../useUnifiedProjection"
import { useMonteCarloSimulation } from "../useMonteCarloSimulation"
import { usePlanExpenses } from "../usePlanExpenses"
import { useExpenseCategories } from "../useExpenseCategories"
import { useLifestyleCatalog } from "../useLifestyleCatalog"
import IndependenceReport from "./IndependenceReport"

/**
 * Wires the report to live data. The plan page hands over the projection it
 * already computed (so the report matches what the user sees) and this
 * container adds the three things the page does not hold: plan expenses +
 * catalog for the Lifestyle section, and a seeded Monte Carlo run.
 */
export interface IndependenceReportContainerProps {
  plan: RetirementPlan
  projection: RetirementProjection
  baselineProjection: RetirementProjection | null
  assets: AssetBreakdown
  scenario: ScenarioState
  monthlyInvestment?: number
  rentalIncome?: RentalIncomeData
  displayCurrency?: string
  effectiveCurrency: string
  planCurrency: string
  ages: ReportAges
  hideValues: boolean
}

export default function IndependenceReportContainer({
  plan,
  projection,
  baselineProjection,
  assets,
  scenario,
  monthlyInvestment,
  rentalIncome,
  displayCurrency,
  effectiveCurrency,
  planCurrency,
  ages,
  hideValues,
}: IndependenceReportContainerProps): React.ReactElement {
  const seed = reportSeed(plan.id, projection.asOfDate)
  const { result, error, runSimulation } = useMonteCarloSimulation({
    plan,
    assets,
    monthlyInvestment,
    scenario,
    rentalIncome,
    displayCurrency,
    seed,
  })
  // One seeded run per distinct set of inputs. `runSimulation` changes
  // identity on any parent re-render that rebuilds assets/scenario, so key
  // the run on the inputs' content: equal inputs never re-post, changed
  // inputs (holdings refresh, scenario edit) re-run with the same seed.
  // Keys are sorted so a re-fetch that reorders a record (rental income by
  // currency) does not count as a change.
  const inputKey = stableStringify({
    seed,
    assets,
    scenario,
    monthlyInvestment,
    rentalIncome,
    displayCurrency,
  })
  const lastRunKey = useRef<string | null>(null)
  useEffect(() => {
    if (lastRunKey.current === inputKey) return
    lastRunKey.current = inputKey
    void runSimulation()
  }, [inputKey, runSimulation])

  const { expenses } = usePlanExpenses(plan.id)
  const { labels } = useExpenseCategories()
  const { catalog } = useLifestyleCatalog(planCurrency)
  const lifestyle = useMemo(
    () => buildLifestyleSummary({ expenses, projection, labels, catalog }),
    [expenses, projection, labels, catalog],
  )

  return (
    <IndependenceReport
      plan={plan}
      projection={projection}
      baselineProjection={baselineProjection}
      mc={result}
      seed={seed}
      ages={ages}
      effectiveCurrency={effectiveCurrency}
      hideValues={hideValues}
      lifestyle={lifestyle}
      mcError={error?.message ?? null}
    />
  )
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b, "en-US"),
          ),
        )
      : v,
  )
}
