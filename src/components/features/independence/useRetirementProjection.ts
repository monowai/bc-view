import { useState, useCallback, useEffect, useRef } from "react"
import {
  RetirementPlan,
  RetirementProjection,
  ProjectionResponse,
} from "types/independence"
import { WhatIfAdjustments, ScenarioOverrides } from "./types"

// Rental income by currency from RE asset configs
export interface RentalIncomeData {
  monthlyNetByCurrency: Record<string, number> // currency -> net monthly rental
  totalMonthlyInPlanCurrency: number // converted to plan currency
}

interface UseRetirementProjectionProps {
  plan: RetirementPlan | undefined
  liquidAssets: number
  nonSpendableAssets: number
  selectedPortfolioIds: string[]
  currentAge: number | undefined
  retirementAge: number
  lifeExpectancy: number
  monthlyInvestment: number
  whatIfAdjustments: WhatIfAdjustments
  scenarioOverrides: ScenarioOverrides
  spendableCategories: string[]
  rentalIncome?: RentalIncomeData // Optional rental income from RE assets
}

interface UseRetirementProjectionResult {
  projection: RetirementProjection | null
  adjustedProjection: RetirementProjection | null
  isCalculating: boolean
  calculateProjection: () => Promise<void>
  resetProjection: () => void
}

export function useRetirementProjection({
  plan,
  liquidAssets,
  nonSpendableAssets,
  selectedPortfolioIds,
  currentAge,
  retirementAge,
  lifeExpectancy,
  monthlyInvestment,
  whatIfAdjustments,
  scenarioOverrides,
  spendableCategories,
  rentalIncome,
}: UseRetirementProjectionProps): UseRetirementProjectionResult {
  const [projection, setProjection] = useState<RetirementProjection | null>(
    null,
  )
  const [isCalculating, setIsCalculating] = useState(false)
  const hasAutoCalculated = useRef(false)

  const calculateProjection = useCallback(async (): Promise<void> => {
    if (!plan || liquidAssets === 0) return

    setIsCalculating(true)
    try {
      // Calculate effective values with What-If adjustments applied
      // scenarioOverrides are direct overrides (user typed values)
      // whatIfAdjustments apply percentage/offset adjustments on top
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

      // Return rate offset is in percentage points (e.g., -1 means subtract 1%)
      const effectiveCashReturnRate =
        baseCashReturnRate + whatIfAdjustments.returnRateOffset / 100
      const effectiveEquityReturnRate =
        baseEquityReturnRate + whatIfAdjustments.returnRateOffset / 100
      // Housing rate not affected by return rate offset (it's for investable assets)
      const effectiveHousingReturnRate = baseHousingReturnRate

      const baseInflationRate =
        scenarioOverrides.inflationRate ?? plan.inflationRate
      const effectiveInflationRate =
        baseInflationRate + whatIfAdjustments.inflationOffset / 100

      // Apply retirement age offset
      const effectiveRetirementAge =
        retirementAge + whatIfAdjustments.retirementAgeOffset

      // Apply contribution percentage adjustment
      const effectiveMonthlyContribution = Math.round(
        monthlyInvestment * (whatIfAdjustments.contributionPercent / 100),
      )

      const response = await fetch(`/api/independence/projection/${plan.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liquidAssets,
          nonSpendableAssets,
          portfolioIds: selectedPortfolioIds,
          currency: plan.expensesCurrency,
          currentAge,
          retirementAge: effectiveRetirementAge,
          lifeExpectancy,
          monthlyContribution: effectiveMonthlyContribution,
          rentalIncomeMonthly: rentalIncome?.totalMonthlyInPlanCurrency || 0,
          // Plan value overrides (What-If adjusted values)
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
        }),
      })

      if (response.ok) {
        const result: ProjectionResponse = await response.json()
        setProjection(result.data)
      }
    } catch (err) {
      console.error("Failed to calculate projection:", err)
    } finally {
      setIsCalculating(false)
    }
  }, [
    plan,
    liquidAssets,
    nonSpendableAssets,
    selectedPortfolioIds,
    currentAge,
    retirementAge,
    lifeExpectancy,
    monthlyInvestment,
    rentalIncome,
    scenarioOverrides,
    whatIfAdjustments,
  ])

  // Track previous What-If values to detect changes
  const prevWhatIfRef = useRef<string>("")

  // Auto-calculate projection when data is ready
  useEffect(() => {
    if (
      plan &&
      liquidAssets > 0 &&
      spendableCategories.length > 0 &&
      !hasAutoCalculated.current &&
      !projection
    ) {
      hasAutoCalculated.current = true
      calculateProjection()
    }
  }, [plan, liquidAssets, spendableCategories, projection, calculateProjection])

  // Recalculate when What-If values change (debounced)
  useEffect(() => {
    if (!plan || liquidAssets === 0 || !hasAutoCalculated.current) return

    // Create a key from current What-If values
    const whatIfKey = JSON.stringify({
      scenarioOverrides,
      whatIfAdjustments,
      retirementAge,
    })

    // Skip if values haven't changed
    if (whatIfKey === prevWhatIfRef.current) return
    prevWhatIfRef.current = whatIfKey

    // Debounce recalculation to avoid excessive API calls during slider dragging
    const timeoutId = setTimeout(() => {
      calculateProjection()
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [
    plan,
    liquidAssets,
    scenarioOverrides,
    whatIfAdjustments,
    retirementAge,
    calculateProjection,
  ])

  // Reset projection when categories change
  const resetProjection = useCallback((): void => {
    setProjection(null)
    hasAutoCalculated.current = false
    prevWhatIfRef.current = ""
  }, [])

  // The backend now handles all What-If calculations.
  // The projection returned from calculateProjection already includes all adjustments.
  // We simply pass it through as adjustedProjection for API compatibility.
  const adjustedProjection = projection

  return {
    projection,
    adjustedProjection,
    isCalculating,
    calculateProjection,
    resetProjection,
  }
}
