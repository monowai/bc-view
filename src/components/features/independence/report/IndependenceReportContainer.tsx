import React, { useEffect, useMemo } from "react"
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
  const { result, runSimulation } = useMonteCarloSimulation({
    plan,
    assets,
    monthlyInvestment,
    scenario,
    rentalIncome,
    displayCurrency,
    seed,
  })
  // One seeded run per projection. Same seed + same inputs = same fan chart.
  useEffect(() => {
    void runSimulation()
  }, [runSimulation])

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
    />
  )
}
