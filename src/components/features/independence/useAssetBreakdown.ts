import { useMemo } from "react"
import { HoldingContract, ValueInOption } from "types/beancounter"

// Asset categories considered non-spendable (illiquid)
const NON_SPENDABLE_CATEGORIES = ["Property", "Real Estate"]

export interface AssetBreakdown {
  /** Liquid/spendable assets (everything except property) */
  liquidAssets: number
  /** Non-spendable/illiquid assets (property, real estate) */
  nonSpendableAssets: number
  /** Total assets (liquid + non-spendable) */
  totalAssets: number
  /** Whether holdings data is available */
  hasAssets: boolean
}

/**
 * Calculates liquid vs non-spendable asset breakdown from holdings data.
 * Property/Real Estate is considered non-spendable, everything else is liquid.
 *
 * @param holdingsData - Aggregated holdings from svc-position
 * @param valueIn - Which currency value to use (PORTFOLIO, BASE, or TRADE). Defaults to PORTFOLIO.
 * @returns Asset breakdown with liquid, non-spendable, and total values
 */
export function useAssetBreakdown(
  holdingsData: HoldingContract | undefined | null,
  valueIn: ValueInOption = "PORTFOLIO",
): AssetBreakdown {
  return useMemo(() => {
    return calculateAssetBreakdown(holdingsData, valueIn)
  }, [holdingsData, valueIn])
}

/**
 * Pure function version for use outside of React components.
 *
 * @param holdingsData - Aggregated holdings from svc-position
 * @param valueIn - Which currency value to use (PORTFOLIO, BASE, or TRADE). Defaults to PORTFOLIO.
 */
export function calculateAssetBreakdown(
  holdingsData: HoldingContract | undefined | null,
  valueIn: ValueInOption = "PORTFOLIO",
): AssetBreakdown {
  if (!holdingsData?.positions) {
    return {
      liquidAssets: 0,
      nonSpendableAssets: 0,
      totalAssets: 0,
      hasAssets: false,
    }
  }

  let liquid = 0
  let nonSpendable = 0

  Object.values(holdingsData.positions).forEach((position) => {
    const category = position.asset?.assetCategory?.name || "Uncategorised"
    const value = position.moneyValues?.[valueIn]?.marketValue || 0

    if (NON_SPENDABLE_CATEGORIES.includes(category)) {
      nonSpendable += value
    } else {
      liquid += value
    }
  })

  return {
    liquidAssets: liquid,
    nonSpendableAssets: nonSpendable,
    totalAssets: liquid + nonSpendable,
    hasAssets: liquid > 0 || nonSpendable > 0,
  }
}
