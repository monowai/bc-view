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
