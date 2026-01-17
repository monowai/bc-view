import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import {
  RetirementPlan,
  RetirementProjection,
  ProjectionResponse,
} from "types/independence"
import { WhatIfAdjustments, ScenarioOverrides } from "./types"

/**
 * Simple hash function to create a numeric checksum from a string.
 * Uses djb2 algorithm - fast and provides good distribution.
 */
function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return hash >>> 0 // Convert to unsigned 32-bit integer
}

/**
 * Creates a checksum from What-If values for change detection.
 */
export function createWhatIfChecksum(
  scenarioOverrides: ScenarioOverrides,
  whatIfAdjustments: WhatIfAdjustments,
  retirementAge: number,
): number {
  const key = JSON.stringify({
    scenarioOverrides,
    whatIfAdjustments,
    retirementAge,
  })
  return hashString(key)
}

/**
 * Creates a checksum from plan details that affect projections.
 * Used to detect when plan edits require recalculation.
 */
export function createPlanChecksum(plan: RetirementPlan | undefined): number {
  if (!plan) return 0
  const key = JSON.stringify({
    // Core plan values that affect projections
    monthlyExpenses: plan.monthlyExpenses,
    pensionMonthly: plan.pensionMonthly,
    socialSecurityMonthly: plan.socialSecurityMonthly,
    otherIncomeMonthly: plan.otherIncomeMonthly,
    equityReturnRate: plan.equityReturnRate,
    cashReturnRate: plan.cashReturnRate,
    housingReturnRate: plan.housingReturnRate,
    inflationRate: plan.inflationRate,
    lifeExpectancy: plan.lifeExpectancy,
    planningHorizonYears: plan.planningHorizonYears,
    targetBalance: plan.targetBalance,
    equityAllocation: plan.equityAllocation,
    cashAllocation: plan.cashAllocation,
    housingAllocation: plan.housingAllocation,
    workingIncomeMonthly: plan.workingIncomeMonthly,
    workingExpensesMonthly: plan.workingExpensesMonthly,
    investmentAllocationPercent: plan.investmentAllocationPercent,
    yearOfBirth: plan.yearOfBirth,
  })
  return hashString(key)
}

/**
 * Creates a combined checksum from plan, What-If values, and asset values.
 */
export function createProjectionChecksum(
  plan: RetirementPlan | undefined,
  scenarioOverrides: ScenarioOverrides,
  whatIfAdjustments: WhatIfAdjustments,
  retirementAge: number,
  liquidAssets?: number,
): number {
  const planChecksum = createPlanChecksum(plan)
  const whatIfChecksum = createWhatIfChecksum(
    scenarioOverrides,
    whatIfAdjustments,
    retirementAge,
  )
  // Include liquidAssets in checksum so changes trigger recalculation
  const assetChecksum = Math.round(liquidAssets ?? 0)
  // Combine checksums using XOR and bit rotation for better distribution
  return (
    ((planChecksum << 16) | (planChecksum >>> 16)) ^
    whatIfChecksum ^
    assetChecksum
  )
}

// Rental income by currency from RE asset configs
export interface RentalIncomeData {
  monthlyNetByCurrency: Record<string, number> // currency -> net monthly rental
  totalMonthlyInPlanCurrency: number // converted to plan currency
}

interface UseRetirementProjectionProps {
  plan: RetirementPlan | undefined
  selectedPortfolioIds: string[]
  currentAge: number | undefined
  retirementAge: number
  lifeExpectancy: number
  monthlyInvestment: number
  whatIfAdjustments: WhatIfAdjustments
  scenarioOverrides: ScenarioOverrides
  /** Optional rental income (backend fetches from svc-data if not provided) */
  rentalIncome?: RentalIncomeData
  /** Display currency for FX conversion. Backend converts all values. */
  displayCurrency?: string
  /** Pre-calculated liquid assets (avoids backend refetch from svc-position) */
  liquidAssets?: number
  /** Pre-calculated non-spendable assets (avoids backend refetch from svc-position) */
  nonSpendableAssets?: number
}

interface UseRetirementProjectionResult {
  projection: RetirementProjection | null
  adjustedProjection: RetirementProjection | null
  isCalculating: boolean
  calculateProjection: () => Promise<void>
  resetProjection: () => void
  /** Checksum of current What-If values - changes when any What-If value changes */
  whatIfChecksum: number
}

export function useRetirementProjection({
  plan,
  selectedPortfolioIds,
  currentAge,
  retirementAge,
  lifeExpectancy,
  monthlyInvestment,
  whatIfAdjustments,
  scenarioOverrides,
  rentalIncome,
  displayCurrency,
  liquidAssets,
  nonSpendableAssets,
}: UseRetirementProjectionProps): UseRetirementProjectionResult {
  const [projection, setProjection] = useState<RetirementProjection | null>(
    null,
  )
  const [isCalculating, setIsCalculating] = useState(false)
  const hasAutoCalculated = useRef(false)

  const calculateProjection = useCallback(async (): Promise<void> => {
    if (!plan) return

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

      // Debug logging for projection calculation
      console.log("[Projection] === Request Values ===")
      console.log("[Projection] monthlyInvestment:", monthlyInvestment)
      console.log(
        "[Projection] contributionPercent:",
        whatIfAdjustments.contributionPercent,
      )
      console.log(
        "[Projection] effectiveMonthlyContribution:",
        effectiveMonthlyContribution,
      )
      console.log("[Projection] liquidAssets (input):", liquidAssets)
      console.log("[Projection] monthlyExpenses:", effectiveMonthlyExpenses)

      // Build request body - include asset values if provided to avoid backend refetch
      const requestBody: Record<string, unknown> = {
        portfolioIds: selectedPortfolioIds,
        currency: plan.expensesCurrency,
        displayCurrency, // Backend converts all values to this currency
        currentAge,
        retirementAge: effectiveRetirementAge,
        lifeExpectancy,
        monthlyContribution: effectiveMonthlyContribution,
        // Plan value overrides (What-If adjusted values)
        monthlyExpenses: effectiveMonthlyExpenses,
        cashReturnRate: effectiveCashReturnRate,
        equityReturnRate: effectiveEquityReturnRate,
        housingReturnRate: effectiveHousingReturnRate,
        inflationRate: effectiveInflationRate,
        pensionMonthly: scenarioOverrides.pensionMonthly ?? plan.pensionMonthly,
        socialSecurityMonthly:
          scenarioOverrides.socialSecurityMonthly ?? plan.socialSecurityMonthly,
        otherIncomeMonthly:
          scenarioOverrides.otherIncomeMonthly ?? plan.otherIncomeMonthly,
        targetBalance: scenarioOverrides.targetBalance ?? plan.targetBalance,
        liquidationThreshold: whatIfAdjustments.liquidationThreshold,
      }

      // Pass pre-calculated asset values to avoid backend refetch from svc-position
      // Only pass if values are > 0 (0 means data hasn't loaded yet, let backend fetch)
      if (liquidAssets !== undefined && liquidAssets > 0) {
        requestBody.liquidAssets = liquidAssets
      }
      if (nonSpendableAssets !== undefined && nonSpendableAssets > 0) {
        requestBody.nonSpendableAssets = nonSpendableAssets
      }
      if (rentalIncome?.totalMonthlyInPlanCurrency) {
        requestBody.rentalIncomeMonthly =
          rentalIncome.totalMonthlyInPlanCurrency
      }

      const response = await fetch(`/api/independence/projection/${plan.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        const result: ProjectionResponse = await response.json()
        console.log("[Projection] === Response Values ===")
        console.log(
          "[Projection] fiMetrics.fiNumber:",
          result.data.fiMetrics?.fiNumber,
        )
        console.log(
          "[Projection] fiMetrics.fiProgress:",
          result.data.fiMetrics?.fiProgress,
        )
        console.log(
          "[Projection] fiMetrics.realYearsToFi:",
          result.data.fiMetrics?.realYearsToFi,
        )
        console.log(
          "[Projection] liquidAssets (response):",
          result.data.liquidAssets,
        )
        setProjection(result.data)
      }
    } catch (err) {
      console.error("Failed to calculate projection:", err)
    } finally {
      setIsCalculating(false)
    }
  }, [
    plan,
    selectedPortfolioIds,
    currentAge,
    retirementAge,
    lifeExpectancy,
    monthlyInvestment,
    rentalIncome,
    scenarioOverrides,
    whatIfAdjustments,
    displayCurrency,
    liquidAssets,
    nonSpendableAssets,
  ])

  // Calculate combined checksum for plan + What-If values + assets - memoized for efficiency
  // This triggers recalculation when plan details, What-If adjustments, or assets change
  const projectionChecksum = useMemo(
    () =>
      createProjectionChecksum(
        plan,
        scenarioOverrides,
        whatIfAdjustments,
        retirementAge,
        liquidAssets,
      ),
    [plan, scenarioOverrides, whatIfAdjustments, retirementAge, liquidAssets],
  )

  // Also expose the What-If only checksum for backwards compatibility
  const whatIfChecksum = useMemo(
    () =>
      createWhatIfChecksum(scenarioOverrides, whatIfAdjustments, retirementAge),
    [scenarioOverrides, whatIfAdjustments, retirementAge],
  )

  // Track previous checksum to detect changes
  const prevChecksumRef = useRef<number>(0)

  // Auto-calculate projection when plan is ready
  // Backend fetches asset values from svc-position and determines spendable categories
  useEffect(() => {
    if (plan && !hasAutoCalculated.current && !projection) {
      hasAutoCalculated.current = true
      prevChecksumRef.current = projectionChecksum
      calculateProjection()
    }
  }, [plan, projection, calculateProjection, projectionChecksum])

  // Recalculate when plan or What-If checksum changes (debounced)
  useEffect(() => {
    if (!plan || !hasAutoCalculated.current) return undefined

    // Skip if checksum hasn't changed
    if (projectionChecksum === prevChecksumRef.current) return undefined
    prevChecksumRef.current = projectionChecksum

    // Debounce recalculation to avoid excessive API calls during slider dragging
    const timeoutId = setTimeout(() => {
      calculateProjection()
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [plan, projectionChecksum, calculateProjection])

  // Reset projection when categories change
  const resetProjection = useCallback((): void => {
    setProjection(null)
    hasAutoCalculated.current = false
    prevChecksumRef.current = 0
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
    whatIfChecksum,
  }
}
