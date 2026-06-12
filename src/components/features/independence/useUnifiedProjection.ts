import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import useSwr from "swr"
import {
  RetirementPlan,
  RetirementProjection,
  ProjectionResponse,
} from "types/independence"
import {
  scenarioToPayload,
  type ScenarioPayloadCtx,
} from "./scenario/scenarioToPayload"
import { DEFAULT_SCENARIO_STATE, type ScenarioState } from "./scenario/types"
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
 * Creates a checksum from the scenario state for change detection. Drives
 * the debounced recalculation effect — a stable checksum skips the API hit.
 */
export function createScenarioChecksum(scenario: ScenarioState): number {
  return hashString(JSON.stringify(scenario))
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
  /** Monthly investment amount (full mode only). */
  monthlyInvestment?: number
  /**
   * Unified scenario state. When omitted the hook falls back to defaults,
   * useful for the simple/widget mode that doesn't model what-if.
   */
  scenario?: ScenarioState
  /**
   * Caller-known flag indicating the scenario matches the seeded baseline.
   * When true the result is captured as `baselineProjection` so the chart
   * can overlay it once the user starts moving sliders.
   */
  isAtBaseline?: boolean
  /** Optional rental income data (full mode only). */
  rentalIncome?: RentalIncomeData
  /** Optional defined contribution amount override (full mode only). */
  definedContribution?: number
  /**
   * Caller doesn't own the plan. Omits `liquidAssets` /
   * `nonSpendableAssets` from the request so svc-retire resolves them
   * server-side under the plan owner's M2M scope. Also relaxes the
   * assets-ready gate — the viewer doesn't need their own holdings
   * loaded to project someone else's plan.
   */
  isSharedPlan?: boolean
  /** Request the optional ProjectionDebug block in the response. */
  includeDebug?: boolean
}

interface UseUnifiedProjectionResult {
  /** The projection response from the backend */
  projection: RetirementProjection | null
  /** Alias for projection (backwards compatibility with useRetirementProjection) */
  adjustedProjection: RetirementProjection | null
  /** Baseline projection (when no what-if adjustments active) for chart comparison */
  baselineProjection: RetirementProjection | null
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
  /** Checksum of the current scenario state — drives the debounced refetch. */
  scenarioChecksum: number
}

/**
 * Unified hook for fetching retirement projections.
 *
 * Supports two modes:
 * 1. **Simple mode**: For widgets (wealth page, PlanCard). Just pass plan and assets.
 * 2. **Full mode**: For plan detail page. Pass the ScenarioState and rental income.
 *
 * Key principles:
 * - Assets MUST be provided by the frontend (via useAssetBreakdown)
 * - Backend never fetches from svc-position (single source of truth)
 * - Scenario state is the single source of truth for plan-overridable values
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
 * const { scenario, isDirty } = useScenario(plan, settings)
 * const { projection, isCalculating, resetProjection } = useUnifiedProjection({
 *   plan,
 *   assets,
 *   scenario,
 *   isAtBaseline: !isDirty,
 *   displayCurrency,
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
  monthlyInvestment = 0,
  scenario = DEFAULT_SCENARIO_STATE,
  isAtBaseline = false,
  rentalIncome,
  definedContribution,
  isSharedPlan = false,
  includeDebug = false,
}: UseUnifiedProjectionProps): UseUnifiedProjectionResult {
  const [projection, setProjection] = useState<RetirementProjection | null>(
    null,
  )
  const [baselineProjection, setBaselineProjection] =
    useState<RetirementProjection | null>(null)
  const baselineDisplayCurrencyRef = useRef<string | undefined>(undefined)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const hasAutoCalculated = useRef(false)

  // Determine if we have the minimum required data. Shared-plan path
  // doesn't need the viewer's holdings (svc-retire resolves the owner's
  // server-side); only require the plan id.
  const isReady = enabled && !!plan?.id && (isSharedPlan || assets.hasAssets)

  // Detect changes via single scenario checksum + plan checksum + asset/currency.
  const planChecksum = useMemo(() => createPlanChecksum(plan), [plan])
  const scenarioChecksum = useMemo(
    () => createScenarioChecksum(scenario),
    [scenario],
  )

  const projectionChecksum = useMemo(() => {
    const assetChecksum = Math.round(assets.liquidAssets)
    const currencyChecksum = displayCurrency ? hashString(displayCurrency) : 0
    return (
      ((planChecksum << 16) | (planChecksum >>> 16)) ^
      scenarioChecksum ^
      assetChecksum ^
      currencyChecksum
    )
  }, [planChecksum, scenarioChecksum, assets.liquidAssets, displayCurrency])

  // Track previous checksum to detect changes
  const prevChecksumRef = useRef<number>(0)

  const calculateProjection = useCallback(async (): Promise<void> => {
    if (!plan) return
    if (!isSharedPlan && !assets.hasAssets) return

    setIsCalculating(true)
    setError(null)

    try {
      const ctx: ScenarioPayloadCtx = {
        plan,
        selectedPortfolioIds,
        displayCurrency,
        monthlyInvestment,
        rentalIncome,
        derivedLiquidAssets: assets.liquidAssets,
        derivedNonSpendableAssets: assets.nonSpendableAssets,
        isSharedPlan,
        includeDebug,
      }
      if (definedContribution != null) {
        ctx.definedContribution = definedContribution
      }
      const requestBody = scenarioToPayload(scenario, ctx)

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

      // Capture baseline when the scenario matches the seeded plan defaults.
      if (isAtBaseline) {
        setBaselineProjection(result.data)
        baselineDisplayCurrencyRef.current = displayCurrency
      } else if (displayCurrency !== baselineDisplayCurrencyRef.current) {
        setBaselineProjection(null)
      }
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
    monthlyInvestment,
    rentalIncome,
    scenario,
    isAtBaseline,
    displayCurrency,
    definedContribution,
    isSharedPlan,
    includeDebug,
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
    setBaselineProjection(null)
    baselineDisplayCurrencyRef.current = undefined
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
    baselineProjection,
    isLoading: isCalculating,
    isCalculating,
    error,
    recalculate,
    resetProjection,
    scenarioChecksum,
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

  // Track if we're waiting for assets — only spin when holdings haven't loaded yet.
  // An empty portfolio (isLoaded=true, hasAssets=false) should NOT spin indefinitely.
  const waitingForAssets = !!projectionUrl && !assets.isLoaded

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
