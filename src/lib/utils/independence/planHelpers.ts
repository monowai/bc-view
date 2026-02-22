import { AllocationSlice } from "@lib/allocation/aggregateHoldings"
import { ManualAssetCategory } from "types/independence"

export const HIDDEN_VALUE = "****"

// Manual asset category display configuration
export const MANUAL_ASSET_CONFIG: Record<
  ManualAssetCategory,
  { label: string; color: string; isSpendable: boolean }
> = {
  CASH: { label: "Cash", color: "#6B7280", isSpendable: true },
  EQUITY: { label: "Equity", color: "#3B82F6", isSpendable: true },
  ETF: { label: "ETF", color: "#10B981", isSpendable: true },
  MUTUAL_FUND: { label: "Mutual Fund", color: "#8B5CF6", isSpendable: true },
  RE: { label: "Property", color: "#F59E0B", isSpendable: false },
}

/**
 * Convert plan's manual asset values to AllocationSlice format.
 * Used when user has no portfolio holdings but has entered manual asset values.
 */
export function manualAssetsToSlices(
  manualAssets: Record<string, number> | undefined,
): AllocationSlice[] {
  if (!manualAssets) return []

  const slices: AllocationSlice[] = []
  const total = Object.values(manualAssets).reduce((sum, v) => sum + v, 0)

  for (const [category, value] of Object.entries(manualAssets)) {
    if (value <= 0) continue
    const config = MANUAL_ASSET_CONFIG[category as ManualAssetCategory]
    if (!config) continue

    slices.push({
      key: config.label,
      label: config.label,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
      color: config.color,
      gainOnDay: 0,
      irr: 0,
    })
  }

  return slices
}

/**
 * Parse manualAssets from JSON string if needed.
 * Backend stores as JSON string, but we need it as an object.
 */
export function parseManualAssets(
  manualAssets: Record<string, number> | string | undefined | null,
): Record<string, number> | undefined {
  if (!manualAssets) return undefined
  if (typeof manualAssets === "object") {
    return manualAssets
  }
  try {
    return JSON.parse(manualAssets)
  } catch {
    return undefined
  }
}

/**
 * Check if plan has manual assets with non-zero values.
 */
export function hasManualAssets(
  manualAssets: Record<string, number> | string | undefined | null,
): boolean {
  const parsed = parseManualAssets(manualAssets)
  if (!parsed) return false
  return Object.values(parsed).some((v) => v > 0)
}

// Pension/Policy FV projection for Assets tab
export interface PensionProjection {
  assetId: string
  assetName: string
  currentValue: number
  projectedValue: number
  payoutAge: number
  currency: string
  category: string
  cpfLifePlan?: "STANDARD" | "BASIC" | "ESCALATING"
  monthlyPayout?: number
}
