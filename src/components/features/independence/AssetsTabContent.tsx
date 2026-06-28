import React from "react"
import { RetirementProjection } from "types/independence"
import { FiMetrics } from "@components/features/independence"
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
          pathToHorizon={projection.pathToHorizon}
          view={view}
          inflationRate={effectivePlanValues?.inflationRate ?? 0.025}
          equityReturnRate={effectivePlanValues?.equityReturnRate ?? 0.07}
          cashReturnRate={effectivePlanValues?.cashReturnRate ?? 0.012}
          equityAllocation={effectivePlanValues?.equityAllocation ?? 0.0}
          cashAllocation={effectivePlanValues?.cashAllocation ?? 1.0}
        />
      )}
    </div>
  )
}
