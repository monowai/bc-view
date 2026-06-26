import { PortfolioBreakdown } from "types/beancounter"

/**
 * Minimal shape of the aggregated holdings groups needed to find, per asset,
 * the portfolios that hold it. Kept structural so it accepts the full
 * `HoldingGroup` map without coupling to its other fields.
 */
interface BreakdownPosition {
  asset: { id: string }
  portfolioBreakdown?: PortfolioBreakdown[]
}
interface BreakdownGroup {
  positions: BreakdownPosition[]
}

/**
 * Build a lookup from asset id to the list of portfolios holding that asset,
 * so the aggregated holdings actions can resolve which portfolio to act on.
 */
export function indexBreakdownByAssetId(
  holdingGroups: Record<string, BreakdownGroup>,
): Map<string, PortfolioBreakdown[]> {
  const index = new Map<string, PortfolioBreakdown[]>()
  for (const group of Object.values(holdingGroups)) {
    for (const position of group.positions) {
      if (position.portfolioBreakdown && position.portfolioBreakdown.length) {
        index.set(position.asset.id, position.portfolioBreakdown)
      }
    }
  }
  return index
}

interface WeightPosition {
  asset: { id: string }
  moneyValues?: Record<string, { weight?: number } | undefined>
}
interface WeightGroup {
  positions: WeightPosition[]
}

/**
 * Build a lookup from asset id to its weight (as a percentage) within the
 * AGGREGATE view, taken from the backend-computed `moneyValues[valueIn].weight`.
 * The aggregated trade form uses this so "current weight" reflects the asset's
 * share of the whole aggregate, not of the single portfolio the trade lands in.
 */
export function buildAggregateWeightByAssetId(
  holdingGroups: Record<string, WeightGroup>,
  valueIn: string,
): Map<string, number> {
  const index = new Map<string, number>()
  for (const group of Object.values(holdingGroups)) {
    for (const position of group.positions) {
      const weight = position.moneyValues?.[valueIn]?.weight
      if (typeof weight === "number") {
        index.set(position.asset.id, weight * 100)
      }
    }
  }
  return index
}

export type TargetResolution =
  | { kind: "direct"; target: PortfolioBreakdown }
  | { kind: "choose"; options: PortfolioBreakdown[] }
  | { kind: "none" }

/**
 * Decide how an aggregated action picks its portfolio:
 * - held in exactly one  → act on it directly
 * - held in several      → caller must prompt the user to choose
 * - held in none         → nothing to act on
 */
export function resolveTarget(
  breakdown: PortfolioBreakdown[] | undefined,
): TargetResolution {
  if (!breakdown || breakdown.length === 0) return { kind: "none" }
  if (breakdown.length === 1) return { kind: "direct", target: breakdown[0] }
  return { kind: "choose", options: breakdown }
}
