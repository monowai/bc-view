import useSwr from "swr"
import { HoldingContract } from "types/beancounter"
import { RetirementPlan, ProjectionResponse } from "types/independence"
import { useAssetBreakdown } from "./useAssetBreakdown"

interface UseFiProjectionProps {
  /** The retirement plan (or just the ID and currency) */
  plan: RetirementPlan | { id: string; expensesCurrency: string } | undefined
  /** Holdings data for asset calculation */
  holdingsData: HoldingContract | undefined | null
  /** Optional display currency for FX conversion */
  displayCurrency?: string
}

interface UseFiProjectionResult {
  /** The projection response from the backend */
  projection: ProjectionResponse["data"] | undefined
  /** Whether the projection is loading */
  isLoading: boolean
  /** Any error that occurred */
  error: Error | undefined
  /** The calculated asset breakdown */
  assets: {
    liquidAssets: number
    nonSpendableAssets: number
    totalAssets: number
    hasAssets: boolean
  }
}

/**
 * Simple hook for fetching FI projection with pre-calculated assets.
 * Use this for widgets and simple displays. For What-If analysis,
 * use useRetirementProjection instead.
 *
 * @example
 * ```tsx
 * const { projection, isLoading, assets } = useFiProjection({
 *   plan: primaryPlan,
 *   holdingsData,
 * })
 *
 * // Access FI metrics
 * const fiProgress = projection?.fiMetrics?.fiProgress
 * ```
 */
export function useFiProjection({
  plan,
  holdingsData,
  displayCurrency,
}: UseFiProjectionProps): UseFiProjectionResult {
  // Calculate asset breakdown from holdings
  const assets = useAssetBreakdown(holdingsData)

  // Build projection URL
  const projectionUrl = plan?.id
    ? `/api/independence/projection/${plan.id}`
    : null

  // Fetch projection with asset values
  const { data, isLoading, error } = useSwr<ProjectionResponse>(
    // Include assets in cache key so projection updates when assets change
    projectionUrl
      ? [projectionUrl, assets.liquidAssets, assets.nonSpendableAssets]
      : null,
    async () => {
      if (!projectionUrl || !plan) return null
      const res = await fetch(projectionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency: plan.expensesCurrency,
          displayCurrency,
          liquidAssets: assets.liquidAssets,
          nonSpendableAssets: assets.nonSpendableAssets,
        }),
      })
      if (!res.ok) throw new Error("Failed to fetch projection")
      return res.json()
    },
  )

  return {
    projection: data?.data,
    isLoading,
    error,
    assets,
  }
}
