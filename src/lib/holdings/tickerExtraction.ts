import { Position } from "types/beancounter"

const EXCLUDED_CATEGORIES = new Set(["CASH", "ACCOUNT", "POLICY"])

const EXCLUDED_MARKETS = new Set(["PRIVATE"])

export function extractTickers(positions: Record<string, Position>): string[] {
  return Object.values(positions)
    .filter(
      (p) =>
        !EXCLUDED_CATEGORIES.has(p.asset.assetCategory.name) &&
        !EXCLUDED_MARKETS.has(p.asset.market.code),
    )
    .map((p) => p.asset.code)
}
