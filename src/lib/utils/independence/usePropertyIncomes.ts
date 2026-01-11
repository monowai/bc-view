import useSWR, { mutate } from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import {
  PlanPropertyIncome,
  PropertyIncomeRequest,
  PropertyIncomesResponse,
  PropertyIncomeResponse,
} from "types/independence"

interface UsePropertyIncomesResult {
  propertyIncomes: PlanPropertyIncome[]
  isLoading: boolean
  error: Error | undefined
  savePropertyIncome: (
    request: PropertyIncomeRequest,
  ) => Promise<PlanPropertyIncome | null>
  deletePropertyIncome: (assetId: string) => Promise<void>
  getPropertyIncomeForAsset: (assetId: string) => PlanPropertyIncome | undefined
  getTotalRentalByCurrency: () => Record<string, number>
  getPropertiesByLiquidationOrder: () => PlanPropertyIncome[]
}

/**
 * Hook to fetch and manage property income configurations for a retirement plan.
 *
 * @param planId - The retirement plan ID
 * @returns Property incomes data, loading state, error, and mutation functions
 */
export function usePropertyIncomes(
  planId: string | undefined,
): UsePropertyIncomesResult {
  const apiUrl = planId ? `/api/independence/plans/${planId}/properties` : null

  const { data, error, isLoading } = useSWR<PropertyIncomesResponse>(
    apiUrl,
    apiUrl ? simpleFetcher(apiUrl) : null,
  )

  /**
   * Save (create or update) a property income configuration.
   * Uses upsert semantics - if assetId exists, updates; otherwise creates.
   */
  const savePropertyIncome = async (
    request: PropertyIncomeRequest,
  ): Promise<PlanPropertyIncome | null> => {
    if (!planId) return null

    const response = await fetch(
      `/api/independence/plans/${planId}/properties`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      },
    )

    if (!response.ok) {
      throw new Error("Failed to save property income")
    }

    const result: PropertyIncomeResponse = await response.json()

    // Revalidate the property incomes list
    await mutate(apiUrl)

    return result.data
  }

  /**
   * Delete a property income configuration.
   */
  const deletePropertyIncome = async (assetId: string): Promise<void> => {
    if (!planId) return

    const response = await fetch(
      `/api/independence/plans/${planId}/properties/${encodeURIComponent(assetId)}`,
      {
        method: "DELETE",
      },
    )

    if (!response.ok) {
      throw new Error("Failed to delete property income")
    }

    // Revalidate the property incomes list
    await mutate(apiUrl)
  }

  /**
   * Get property income for a specific asset.
   * Returns undefined if not configured.
   */
  const getPropertyIncomeForAsset = (
    assetId: string,
  ): PlanPropertyIncome | undefined => {
    return data?.data?.find((p) => p.assetId === assetId)
  }

  /**
   * Calculate total monthly rental income from all properties (excluding primary residences).
   * Returns amount in their respective currencies (multi-currency aware).
   */
  const getTotalRentalByCurrency = (): Record<string, number> => {
    if (!data?.data) return {}

    return data.data
      .filter((p) => !p.isPrimaryResidence)
      .reduce(
        (acc, p) => {
          const currency = p.rentalCurrency || "NZD"
          acc[currency] = (acc[currency] || 0) + p.monthlyRentalIncome
          return acc
        },
        {} as Record<string, number>,
      )
  }

  /**
   * Get properties sorted by liquidation priority (lowest first).
   */
  const getPropertiesByLiquidationOrder = (): PlanPropertyIncome[] => {
    if (!data?.data) return []
    return [...data.data].sort(
      (a, b) => a.liquidationPriority - b.liquidationPriority,
    )
  }

  return {
    propertyIncomes: data?.data || [],
    isLoading,
    error,
    savePropertyIncome,
    deletePropertyIncome,
    getPropertyIncomeForAsset,
    getTotalRentalByCurrency,
    getPropertiesByLiquidationOrder,
  }
}
