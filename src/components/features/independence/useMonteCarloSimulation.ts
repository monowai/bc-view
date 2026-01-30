import { useState, useCallback } from "react"
import {
  RetirementPlan,
  MonteCarloResult,
  MonteCarloResponse,
} from "types/independence"
import { WhatIfAdjustments, ScenarioOverrides } from "./types"
import { AssetBreakdown } from "./useAssetBreakdown"
import { RentalIncomeData } from "./useUnifiedProjection"

interface UseMonteCarloSimulationProps {
  plan: RetirementPlan | undefined
  assets: AssetBreakdown
  currentAge?: number
  retirementAge?: number
  lifeExpectancy?: number
  monthlyInvestment?: number
  whatIfAdjustments?: WhatIfAdjustments
  scenarioOverrides?: ScenarioOverrides
  rentalIncome?: RentalIncomeData
  displayCurrency?: string
}

interface UseMonteCarloSimulationResult {
  result: MonteCarloResult | null
  isRunning: boolean
  error: Error | null
  runSimulation: (iterations?: number) => Promise<void>
}

const DEFAULT_WHAT_IF: WhatIfAdjustments = {
  retirementAgeOffset: 0,
  expensesPercent: 100,
  returnRateOffset: 0,
  inflationOffset: 0,
  contributionPercent: 100,
  equityPercent: null,
  liquidationThreshold: 10,
}

/**
 * Hook for running Monte Carlo simulations on-demand.
 *
 * Unlike useUnifiedProjection which auto-calculates, this hook
 * exposes a runSimulation() callback that must be triggered explicitly
 * since simulations are computationally expensive.
 */
export function useMonteCarloSimulation({
  plan,
  assets,
  currentAge,
  retirementAge,
  lifeExpectancy,
  monthlyInvestment = 0,
  whatIfAdjustments = DEFAULT_WHAT_IF,
  scenarioOverrides = {},
  rentalIncome,
  displayCurrency,
}: UseMonteCarloSimulationProps): UseMonteCarloSimulationResult {
  const [result, setResult] = useState<MonteCarloResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const runSimulation = useCallback(
    async (iterations: number = 1000): Promise<void> => {
      if (!plan || !assets.hasAssets) return

      setIsRunning(true)
      setError(null)

      try {
        // Apply What-If adjustments (same logic as useUnifiedProjection)
        const baseMonthlyExpenses =
          scenarioOverrides.monthlyExpenses ?? plan.monthlyExpenses
        const effectiveMonthlyExpenses = Math.round(
          baseMonthlyExpenses * (whatIfAdjustments.expensesPercent / 100),
        )

        const baseCashReturnRate =
          scenarioOverrides.cashReturnRate ?? plan.cashReturnRate
        const baseEquityReturnRate =
          scenarioOverrides.equityReturnRate ?? plan.equityReturnRate
        const baseHousingReturnRate =
          scenarioOverrides.housingReturnRate ?? plan.housingReturnRate

        const effectiveCashReturnRate =
          baseCashReturnRate + whatIfAdjustments.returnRateOffset / 100
        const effectiveEquityReturnRate =
          baseEquityReturnRate + whatIfAdjustments.returnRateOffset / 100
        const effectiveHousingReturnRate = baseHousingReturnRate

        const baseInflationRate =
          scenarioOverrides.inflationRate ?? plan.inflationRate
        const effectiveInflationRate =
          baseInflationRate + whatIfAdjustments.inflationOffset / 100

        const effectiveRetirementAge =
          (retirementAge ?? 65) + whatIfAdjustments.retirementAgeOffset

        const effectiveMonthlyContribution = Math.round(
          monthlyInvestment * (whatIfAdjustments.contributionPercent / 100),
        )

        const requestBody: Record<string, unknown> = {
          currency: plan.expensesCurrency,
          displayCurrency,
          currentAge,
          retirementAge: effectiveRetirementAge,
          lifeExpectancy,
          monthlyContribution: effectiveMonthlyContribution,
          monthlyExpenses: effectiveMonthlyExpenses,
          cashReturnRate: effectiveCashReturnRate,
          equityReturnRate: effectiveEquityReturnRate,
          housingReturnRate: effectiveHousingReturnRate,
          inflationRate: effectiveInflationRate,
          pensionMonthly:
            scenarioOverrides.pensionMonthly ?? plan.pensionMonthly,
          socialSecurityMonthly:
            scenarioOverrides.socialSecurityMonthly ??
            plan.socialSecurityMonthly,
          otherIncomeMonthly:
            scenarioOverrides.otherIncomeMonthly ?? plan.otherIncomeMonthly,
          targetBalance: scenarioOverrides.targetBalance ?? plan.targetBalance,
          liquidationThreshold: whatIfAdjustments.liquidationThreshold,
          liquidAssets: assets.liquidAssets,
          nonSpendableAssets: assets.nonSpendableAssets,
          iterations,
        }

        if (rentalIncome?.totalMonthlyInPlanCurrency) {
          requestBody.rentalIncomeMonthly =
            rentalIncome.totalMonthlyInPlanCurrency
        }

        const response = await fetch(
          `/api/independence/projection/${plan.id}/monte-carlo`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          },
        )

        if (!response.ok) {
          const errorMsg = "Failed to run Monte Carlo simulation"
          console.error(errorMsg)
          setError(new Error(errorMsg))
          return
        }

        const data: MonteCarloResponse = await response.json()
        setResult(data.data)
      } catch (err) {
        console.error("Monte Carlo simulation failed:", err)
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setIsRunning(false)
      }
    },
    [
      plan,
      assets,
      currentAge,
      retirementAge,
      lifeExpectancy,
      monthlyInvestment,
      rentalIncome,
      scenarioOverrides,
      whatIfAdjustments,
      displayCurrency,
    ],
  )

  return { result, isRunning, error, runSimulation }
}
