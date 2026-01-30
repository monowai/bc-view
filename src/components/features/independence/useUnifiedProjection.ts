import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import useSwr from "swr"
import {
  RetirementPlan,
  RetirementProjection,
  ProjectionResponse,
} from "types/independence"
import { WhatIfAdjustments, ScenarioOverrides } from "./types"
import { AssetBreakdown } from "./useAssetBreakdown"

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

// Rental income by currency from RE asset configs
export interface RentalIncomeData {
  monthlyNetByCurrency: Record<string, number> // currency -> net monthly rental
  totalMonthlyInPlanCurrency: number // converted to plan currency
}

/**
 * Common props for unified projection hook - supports both simple and full modes.
 */
interface UseUnifiedProjectionProps {
  /** The retirement plan */
  plan: RetirementPlan | undefined
  /** Pre-calculated asset breakdown (REQUIRED - comes from useAssetBreakdown) */
  assets: AssetBreakdown
  /** Optional display currency for FX conversion */
  displayCurrency?: string
  /** Control when to fetch (defaults to true when plan and assets are ready) */
  enabled?: boolean
  // ---- Full mode options (for plan detail page) ----
  /** Selected portfolio IDs (full mode only) */
  selectedPortfolioIds?: string[]
  /** Current age calculated from yearOfBirth (full mode only) */
  currentAge?: number
  /** Retirement age (full mode only) */
  retirementAge?: number
  /** Life expectancy (full mode only) */
  lifeExpectancy?: number
  /** Monthly investment amount (full mode only) */
  monthlyInvestment?: number
  /** What-If slider adjustments (full mode only) */
  whatIfAdjustments?: WhatIfAdjustments
  /** Scenario value overrides (full mode only) */
  scenarioOverrides?: ScenarioOverrides
  /** Optional rental income data (full mode only) */
  rentalIncome?: RentalIncomeData
}

interface UseUnifiedProjectionResult {
  /** The projection response from the backend */
  projection: RetirementProjection | null
  /** Alias for projection (backwards compatibility with useRetirementProjection) */
  adjustedProjection: RetirementProjection | null
  /** Whether the projection is loading or calculating */
  isLoading: boolean
  /** Alias for isLoading (backwards compatibility) */
  isCalculating: boolean
  /** Any error that occurred */
  error: Error | null
  /** Force recalculation (clears cache and refetches) */
  recalculate: () => void
  /** Reset projection state (for category changes) */
  resetProjection: () => void
  /** Checksum of current What-If values */
  whatIfChecksum: number
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
 * Unified hook for fetching retirement projections.
 *
 * Supports two modes:
 * 1. **Simple mode**: For widgets (wealth page, PlanCard). Just pass plan and assets.
 * 2. **Full mode**: For plan detail page. Pass What-If adjustments, scenario overrides, etc.
 *
 * Key principles:
 * - Assets MUST be provided by the frontend (via useAssetBreakdown)
 * - Backend never fetches from svc-position (single source of truth)
 * - Uses SWR with asset values in cache key (auto-updates when assets change)
 *
 * @example Simple mode (for widgets):
 * ```tsx
 * const assets = useAssetBreakdown(holdingsData?.data)
 * const { projection, isLoading } = useUnifiedProjection({ plan, assets })
 * ```
 *
 * @example Full mode (for plan detail):
 * ```tsx
 * const assets = useAssetBreakdown(holdingsData?.data, "PORTFOLIO", nonSpendableCategories)
 * const { projection, isCalculating, resetProjection } = useUnifiedProjection({
 *   plan,
 *   assets,
 *   whatIfAdjustments,
 *   scenarioOverrides,
 *   displayCurrency,
 *   currentAge,
 *   retirementAge,
 *   lifeExpectancy,
 *   monthlyInvestment,
 * })
 * ```
 */
export function useUnifiedProjection({
  plan,
  assets,
  displayCurrency,
  enabled = true,
  // Full mode options
  selectedPortfolioIds = [],
  currentAge,
  retirementAge,
  lifeExpectancy,
  monthlyInvestment = 0,
  whatIfAdjustments = DEFAULT_WHAT_IF,
  scenarioOverrides = {},
  rentalIncome,
}: UseUnifiedProjectionProps): UseUnifiedProjectionResult {
  const [projection, setProjection] = useState<RetirementProjection | null>(
    null,
  )
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const hasAutoCalculated = useRef(false)

  // Determine if we have the minimum required data
  const isReady = enabled && !!plan?.id && assets.hasAssets

  // Calculate checksum for detecting changes
  const planChecksum = useMemo(() => createPlanChecksum(plan), [plan])
  const whatIfChecksum = useMemo(
    () =>
      createWhatIfChecksum(
        scenarioOverrides,
        whatIfAdjustments,
        retirementAge ?? 65,
      ),
    [scenarioOverrides, whatIfAdjustments, retirementAge],
  )

  // Combined checksum including assets and display currency
  const projectionChecksum = useMemo(() => {
    const assetChecksum = Math.round(assets.liquidAssets)
    const currencyChecksum = displayCurrency ? hashString(displayCurrency) : 0
    return (
      ((planChecksum << 16) | (planChecksum >>> 16)) ^
      whatIfChecksum ^
      assetChecksum ^
      currencyChecksum
    )
  }, [planChecksum, whatIfChecksum, assets.liquidAssets, displayCurrency])

  // Track previous checksum to detect changes
  const prevChecksumRef = useRef<number>(0)

  const calculateProjection = useCallback(async (): Promise<void> => {
    if (!plan || !assets.hasAssets) return

    setIsCalculating(true)
    setError(null)

    try {
      // Calculate effective values with What-If adjustments applied
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
        (retirementAge ?? 65) + whatIfAdjustments.retirementAgeOffset

      // Apply contribution percentage adjustment
      const effectiveMonthlyContribution = Math.round(
        monthlyInvestment * (whatIfAdjustments.contributionPercent / 100),
      )

      // Build request body - ALWAYS include asset values (required)
      const requestBody: Record<string, unknown> = {
        portfolioIds: selectedPortfolioIds,
        currency: plan.expensesCurrency,
        displayCurrency,
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
        // ALWAYS pass asset values - backend requires these
        liquidAssets: assets.liquidAssets,
        nonSpendableAssets: assets.nonSpendableAssets,
      }

      // Add rental income if provided
      if (rentalIncome?.totalMonthlyInPlanCurrency) {
        requestBody.rentalIncomeMonthly =
          rentalIncome.totalMonthlyInPlanCurrency
      }

      const response = await fetch(`/api/independence/projection/${plan.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorMsg = "Failed to fetch projection"
        console.error(errorMsg)
        setError(new Error(errorMsg))
        return
      }

      const result: ProjectionResponse = await response.json()
      setProjection(result.data)
    } catch (err) {
      console.error("Failed to calculate projection:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsCalculating(false)
    }
  }, [
    plan,
    assets,
    selectedPortfolioIds,
    currentAge,
    retirementAge,
    lifeExpectancy,
    monthlyInvestment,
    rentalIncome,
    scenarioOverrides,
    whatIfAdjustments,
    displayCurrency,
  ])

  // Auto-calculate when ready
  useEffect(() => {
    if (isReady && !hasAutoCalculated.current && !projection) {
      hasAutoCalculated.current = true
      prevChecksumRef.current = projectionChecksum
      calculateProjection()
    }
  }, [isReady, projection, calculateProjection, projectionChecksum])

  // Recalculate when checksum changes (debounced)
  useEffect(() => {
    if (!isReady || !hasAutoCalculated.current) return undefined

    // Skip if checksum hasn't changed
    if (projectionChecksum === prevChecksumRef.current) return undefined
    prevChecksumRef.current = projectionChecksum

    // Debounce recalculation to avoid excessive API calls during slider dragging
    const timeoutId = setTimeout(() => {
      calculateProjection()
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [isReady, projectionChecksum, calculateProjection])

  const resetProjection = useCallback((): void => {
    setProjection(null)
    setError(null)
    hasAutoCalculated.current = false
    prevChecksumRef.current = 0
  }, [])

  const recalculate = useCallback((): void => {
    resetProjection()
    // Will trigger auto-calculation via useEffect
  }, [resetProjection])

  return {
    projection,
    adjustedProjection: projection, // Backwards compatibility
    isLoading: isCalculating,
    isCalculating,
    error,
    recalculate,
    resetProjection,
    whatIfChecksum,
  }
}

/**
 * Simplified version for widgets that just need FI metrics.
 * Uses SWR for caching and automatic revalidation.
 *
 * @example
 * ```tsx
 * const assets = useAssetBreakdown(holdingsData?.data)
 * const { projection, isLoading } = useFiProjectionSimple({ plan, assets })
 * const fiProgress = projection?.fiMetrics?.fiProgress
 * ```
 */
export function useFiProjectionSimple({
  plan,
  assets,
  displayCurrency,
}: {
  plan: RetirementPlan | { id: string; expensesCurrency: string } | undefined
  assets: AssetBreakdown
  displayCurrency?: string
}): {
  projection: RetirementProjection | null
  isLoading: boolean
  error: Error | undefined
} {
  // Build projection URL
  const projectionUrl = plan?.id
    ? `/api/independence/projection/${plan.id}`
    : null

  // Track if we're waiting for assets - this is a "loading" state even though SWR isn't fetching
  const waitingForAssets = !!projectionUrl && !assets.hasAssets

  // Fetch projection with asset values
  // Only fetch when we have both a plan and assets
  const {
    data,
    isLoading: swrLoading,
    error,
  } = useSwr<ProjectionResponse>(
    // Include assets in cache key so projection updates when assets change
    projectionUrl && assets.hasAssets
      ? [projectionUrl, assets.liquidAssets, assets.nonSpendableAssets]
      : null,
    // Fetcher receives key array - use values from key to avoid stale closure issues
    async ([url, liquidAssets, nonSpendableAssets]: [
      string,
      number,
      number,
    ]) => {
      if (!url || !plan) return null
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency: plan.expensesCurrency,
          displayCurrency,
          liquidAssets,
          nonSpendableAssets,
        }),
      })
      if (!res.ok) throw new Error("Failed to fetch projection")
      return res.json()
    },
    {
      // Don't use stale data - always revalidate when key changes
      revalidateOnMount: true,
      // Disable caching to ensure fresh data
      dedupingInterval: 0,
    },
  )

  // isLoading is true when:
  // 1. We're waiting for assets to load (waitingForAssets)
  // 2. SWR is fetching (swrLoading)
  const isLoading = waitingForAssets || swrLoading

  return {
    // Only return projection if we have valid assets (not stale cached data from different assets)
    projection: assets.hasAssets ? (data?.data ?? null) : null,
    isLoading,
    error,
  }
}
