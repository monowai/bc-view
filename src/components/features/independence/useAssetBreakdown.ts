import { useMemo } from "react"
import { HoldingContract, ValueInOption } from "types/beancounter"

/** Default non-spendable categories (property typically can't be easily liquidated) */
export const DEFAULT_NON_SPENDABLE_CATEGORIES = ["Property", "Real Estate"]

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
 * Property/Real Estate is considered non-spendable by default, everything else is liquid.
 *
 * @param holdingsData - Aggregated holdings from svc-position
 * @param valueIn - Which currency value to use (PORTFOLIO, BASE, or TRADE). Defaults to PORTFOLIO.
 * @param nonSpendableCategories - Categories to consider non-spendable. Defaults to DEFAULT_NON_SPENDABLE_CATEGORIES.
 * @returns Asset breakdown with liquid, non-spendable, and total values
 */
export function useAssetBreakdown(
  holdingsData: HoldingContract | undefined | null,
  valueIn: ValueInOption = "PORTFOLIO",
  nonSpendableCategories: string[] = DEFAULT_NON_SPENDABLE_CATEGORIES,
): AssetBreakdown {
  return useMemo(() => {
    return calculateAssetBreakdown(
      holdingsData,
      valueIn,
      nonSpendableCategories,
    )
  }, [holdingsData, valueIn, nonSpendableCategories])
}

/**
 * Pure function version for use outside of React components.
 *
 * @param holdingsData - Aggregated holdings from svc-position
 * @param valueIn - Which currency value to use (PORTFOLIO, BASE, or TRADE). Defaults to PORTFOLIO.
 * @param nonSpendableCategories - Categories to consider non-spendable. Defaults to DEFAULT_NON_SPENDABLE_CATEGORIES.
 */
export function calculateAssetBreakdown(
  holdingsData: HoldingContract | undefined | null,
  valueIn: ValueInOption = "PORTFOLIO",
  nonSpendableCategories: string[] = DEFAULT_NON_SPENDABLE_CATEGORIES,
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

    if (nonSpendableCategories.includes(category)) {
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
