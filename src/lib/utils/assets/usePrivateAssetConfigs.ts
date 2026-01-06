import useSWR, { mutate } from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import {
  PrivateAssetConfig,
  PrivateAssetConfigRequest,
  PrivateAssetConfigResponse,
  PrivateAssetConfigsResponse,
} from "types/beancounter"

interface UsePrivateAssetConfigsResult {
  configs: PrivateAssetConfig[]
  isLoading: boolean
  error: Error | undefined
  saveConfig: (
    assetId: string,
    request: PrivateAssetConfigRequest,
  ) => Promise<PrivateAssetConfig | null>
  deleteConfig: (assetId: string) => Promise<void>
  getConfigForAsset: (assetId: string) => PrivateAssetConfig | undefined
  getTotalRentalByCurrency: () => Record<string, number>
  getNetRentalByCurrency: () => Record<string, number>
  getConfigsByLiquidationOrder: () => PrivateAssetConfig[]
}

const API_URL = "/api/assets/config"

/**
 * Hook to fetch and manage private asset configurations.
 *
 * These configs are stored at the asset level in svc-data,
 * not tied to specific retirement plans.
 *
 * @returns Asset configs, loading state, error, and mutation functions
 */
export function usePrivateAssetConfigs(): UsePrivateAssetConfigsResult {
  const { data, error, isLoading } = useSWR<PrivateAssetConfigsResponse>(
    API_URL,
    simpleFetcher(API_URL),
  )

  /**
   * Save (create or update) a private asset configuration.
   * Uses upsert semantics - if config exists, updates; otherwise creates.
   */
  const saveConfig = async (
    assetId: string,
    request: PrivateAssetConfigRequest,
  ): Promise<PrivateAssetConfig | null> => {
    const response = await fetch(`${API_URL}/${encodeURIComponent(assetId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error("Failed to save asset config")
    }

    const result: PrivateAssetConfigResponse = await response.json()

    // Revalidate the configs list
    await mutate(API_URL)

    return result.data
  }

  /**
   * Delete a private asset configuration.
   */
  const deleteConfig = async (assetId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${encodeURIComponent(assetId)}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      throw new Error("Failed to delete asset config")
    }

    // Revalidate the configs list
    await mutate(API_URL)
  }

  /**
   * Get config for a specific asset.
   * Returns undefined if not configured.
   */
  const getConfigForAsset = (
    assetId: string,
  ): PrivateAssetConfig | undefined => {
    return data?.data?.find((c) => c.assetId === assetId)
  }

  /**
   * Calculate total monthly gross rental income grouped by currency.
   * Excludes primary residences.
   */
  const getTotalRentalByCurrency = (): Record<string, number> => {
    if (!data?.data) return {}

    return data.data
      .filter((c) => !c.isPrimaryResidence)
      .reduce(
        (acc, c) => {
          const currency = c.rentalCurrency || "NZD"
          acc[currency] = (acc[currency] || 0) + c.monthlyRentalIncome
          return acc
        },
        {} as Record<string, number>,
      )
  }

  /**
   * Calculate total monthly net rental income grouped by currency.
   * Net = gross - all expenses (management, body corp, tax, insurance, other).
   * Excludes primary residences.
   */
  const getNetRentalByCurrency = (): Record<string, number> => {
    if (!data?.data) return {}

    return data.data
      .filter((c) => !c.isPrimaryResidence)
      .reduce(
        (acc, c) => {
          const currency = c.rentalCurrency || "NZD"
          // Management fee: use greater of fixed or percentage
          const percentFee = c.monthlyRentalIncome * c.managementFeePercent
          const effectiveMgmtFee = Math.max(c.monthlyManagementFee, percentFee)
          // Convert annual amounts to monthly
          const monthlyTax = (c.annualPropertyTax || 0) / 12
          const monthlyInsurance = (c.annualInsurance || 0) / 12
          // Total all expenses
          const totalExpenses =
            effectiveMgmtFee +
            (c.monthlyBodyCorporateFee || 0) +
            monthlyTax +
            monthlyInsurance +
            (c.monthlyOtherExpenses || 0)
          const netIncome = c.monthlyRentalIncome - totalExpenses
          acc[currency] = (acc[currency] || 0) + netIncome
          return acc
        },
        {} as Record<string, number>,
      )
  }

  /**
   * Get configs sorted by liquidation priority (lowest first).
   */
  const getConfigsByLiquidationOrder = (): PrivateAssetConfig[] => {
    if (!data?.data) return []
    return [...data.data].sort(
      (a, b) => a.liquidationPriority - b.liquidationPriority,
    )
  }

  return {
    configs: data?.data || [],
    isLoading,
    error,
    saveConfig,
    deleteConfig,
    getConfigForAsset,
    getTotalRentalByCurrency,
    getNetRentalByCurrency,
    getConfigsByLiquidationOrder,
  }
}
