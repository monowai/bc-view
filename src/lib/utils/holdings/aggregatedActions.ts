import { Portfolio, PortfolioBreakdown, QuickSellData } from "types/beancounter"

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

/**
 * Seed the trade form for an action resolved to one portfolio of an
 * aggregated holding. A SELL acts on the chosen portfolio's quantity, not the
 * aggregate; all types scope the broker map (`held`) to that portfolio so the
 * broker picker offers what THAT portfolio holds per broker, falling back to
 * the aggregate-wide map when the row carries none (older backend).
 */
export function tradeSeedForRow(
  data: QuickSellData,
  row: PortfolioBreakdown,
  type: NonNullable<QuickSellData["type"]>,
): QuickSellData {
  return {
    ...data,
    type,
    quantity: type === "SELL" ? row.quantity : data.quantity,
    held: row.held ?? data.held,
  }
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

/**
 * The ids of the portfolios named by `codes`, in `codes` order. The aggregated
 * page is addressed by code while the income API filters by id.
 */
export function portfolioIdsForCodes(
  codes: string[],
  portfolios: Portfolio[],
): string[] {
  const idByCode = new Map(portfolios.map((p) => [p.code, p.id]))
  return [...new Set(codes.flatMap((code) => idByCode.get(code) ?? []))]
}

export interface PortfolioWeight {
  portfolioId: string
  portfolioCode: string
  portfolioName: string
  /** Percentage of the view's market value */
  weight: number
}

interface WeightedPosition {
  moneyValues: { PORTFOLIO?: { marketValue: number } }
  quantityValues: { total: number }
  portfolioBreakdown?: PortfolioBreakdown[]
}

/**
 * Each portfolio's share of an aggregated view, heaviest first. A position's
 * value is split by the quantity each portfolio holds. Uses the PORTFOLIO
 * bucket, the only one in a single currency across every position.
 * `selected` portfolios that hold nothing are listed at zero.
 */
export function portfolioWeights(
  positions: Record<string, WeightedPosition>,
  selected: Portfolio[] = [],
): PortfolioWeight[] {
  const values = new Map<string, PortfolioWeight>()
  const entry = (
    portfolioId: string,
    portfolioCode: string,
    portfolioName: string,
  ): PortfolioWeight => {
    const existing = values.get(portfolioId)
    if (existing) return existing
    const created = { portfolioId, portfolioCode, portfolioName, weight: 0 }
    values.set(portfolioId, created)
    return created
  }

  for (const position of Object.values(positions)) {
    const total = position.quantityValues.total
    if (total === 0) continue
    const marketValue = position.moneyValues.PORTFOLIO?.marketValue ?? 0
    for (const row of position.portfolioBreakdown ?? []) {
      entry(row.portfolioId, row.portfolioCode, row.portfolioName).weight +=
        marketValue * (row.quantity / total)
    }
  }
  for (const portfolio of selected) {
    entry(portfolio.id, portfolio.code, portfolio.name)
  }

  const rows = [...values.values()]
  const viewTotal = Math.abs(rows.reduce((sum, row) => sum + row.weight, 0))
  return rows
    .map((row) => ({
      ...row,
      weight: viewTotal === 0 ? 0 : (row.weight / viewTotal) * 100,
    }))
    .sort(
      (a, b) =>
        b.weight - a.weight || a.portfolioCode.localeCompare(b.portfolioCode),
    )
}
