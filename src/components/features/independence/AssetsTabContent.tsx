import React from "react"
import { RetirementProjection } from "types/independence"
import {
  FiMetrics,
  SustainableSpendingCard,
} from "@components/features/independence"
import type { StrategyView } from "./strategyView"

interface EffectivePlanValues {
  inflationRate: number
  equityReturnRate: number
  cashReturnRate: number
  equityAllocation: number
  cashAllocation: number
}

interface AssetsTabContentProps {
  projection: RetirementProjection | null
  effectivePlanValues: EffectivePlanValues | null
  blendedReturnRate: number
  currentAge: number | undefined
  retirementAge: number
  effectiveCurrency: string
  fireDataReady: boolean
  /** Page-level strategy view — drives FiMetrics section visibility. */
  view: StrategyView
}

/**
 * Metrics tab (formerly "My Assets"): hosts the Retirement Strategies panel
 * and the Sustainable Spending card. Asset-category breakdown moved to the
 * My Plan tab.
 */
export default function AssetsTabContent({
  projection,
  effectivePlanValues,
  blendedReturnRate,
  currentAge,
  retirementAge,
  effectiveCurrency,
  fireDataReady,
  view,
}: AssetsTabContentProps): React.ReactElement {
  return (
    <div className="space-y-6">
      {fireDataReady && projection?.fiMetrics && (
        <FiMetrics
          monthlyExpenses={projection.fiMetrics.netMonthlyExpenses}
          liquidAssets={projection.liquidAssets}
          currency={effectiveCurrency}
          workingIncomeMonthly={
            projection.planInputs?.workingIncomeMonthly ?? 0
          }
          monthlyInvestment={projection.planInputs?.monthlyContribution ?? 0}
          expectedReturnRate={blendedReturnRate}
          currentAge={currentAge}
          retirementAge={retirementAge}
          backendFiMetrics={projection.fiMetrics}
          effectiveStrategy={projection.effectiveStrategy}
          view={view}
          inflationRate={effectivePlanValues?.inflationRate ?? 0.025}
          equityReturnRate={effectivePlanValues?.equityReturnRate ?? 0.08}
          cashReturnRate={effectivePlanValues?.cashReturnRate ?? 0.03}
          equityAllocation={effectivePlanValues?.equityAllocation ?? 0.8}
          cashAllocation={effectivePlanValues?.cashAllocation ?? 0.2}
        />
      )}

      <SustainableSpendingCard
        projection={projection}
        currency={effectiveCurrency}
      />
    </div>
  )
}
