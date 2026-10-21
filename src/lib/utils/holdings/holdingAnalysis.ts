import { Asset, PortfolioBreakdown } from "types/beancounter"

/**
 * Whether a holding row can offer "Analyse my holding": something is held,
 * and the asset is one svc-agent can review — the `hasNews` gate Asset
 * Review uses, on a priced, non-cash asset.
 */
export function canAnalyseHolding(asset: Asset, quantity: number): boolean {
  return quantity > 0 && !asset.cashLike && asset.chartable && asset.hasNews
}

/**
 * The real portfolio a Holding Analysis runs against. A single-portfolio row
 * belongs to the page's portfolio. An aggregated row carries a breakdown, and
 * the page's portfolio is synthetic: analyse it only when one portfolio
 * holds it, otherwise there is no single holding to describe.
 */
export function holdingAnalysisPortfolioCode(
  pagePortfolioCode: string,
  breakdown: PortfolioBreakdown[] | undefined,
): string | undefined {
  if (!breakdown || breakdown.length === 0) return pagePortfolioCode
  return breakdown.length === 1 ? breakdown[0].portfolioCode : undefined
}
