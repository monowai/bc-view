import { useMemo } from "react"
import useSwr from "swr"
import { simpleFetcher, portfoliosKey } from "@utils/api/fetchHelper"
import { Portfolio, PortfolioResponses } from "types/beancounter"
import { parseExcludedPortfolioIds } from "@lib/independence/planHelpers"

interface HoldingsResponse {
  data?: {
    positions?: Record<string, { asset: { id: string } }>
  }
}

/**
 * Given excluded portfolio IDs (or a raw JSON string from the plan),
 * fetches holdings for those portfolios and returns their asset IDs.
 * Used to filter rental income display on the frontend.
 *
 * @param excludedPortfolioIds - IDs to exclude (string[] or JSON string)
 * @param portfolios - Optional pre-fetched portfolios. If not provided, fetches own.
 */
export function useExcludedAssetIds(
  excludedPortfolioIds: string[] | string | undefined | null,
  portfolios?: Portfolio[],
): Set<string> {
  const parsed = useMemo(
    () => parseExcludedPortfolioIds(excludedPortfolioIds),
    [excludedPortfolioIds],
  )

  // Self-fetch portfolios if not provided
  const needsFetch = parsed.length > 0 && !portfolios
  const { data: fetchedPortfolios } = useSwr<PortfolioResponses>(
    needsFetch ? portfoliosKey : null,
    needsFetch ? simpleFetcher(portfoliosKey) : null,
  )

  // Find portfolio codes for excluded IDs
  const excludedCodes = useMemo(() => {
    const effective = portfolios || fetchedPortfolios?.data || []
    if (parsed.length === 0 || effective.length === 0) return []
    return effective.filter((p) => parsed.includes(p.id)).map((p) => p.code)
  }, [parsed, portfolios, fetchedPortfolios])

  // Fetch holdings for excluded portfolios to get their asset IDs
  const holdingsKey =
    excludedCodes.length > 0
      ? `/api/holdings/aggregated?asAt=today&codes=${excludedCodes.join(",")}`
      : null

  const { data } = useSwr<HoldingsResponse>(
    holdingsKey,
    holdingsKey ? simpleFetcher(holdingsKey) : null,
  )

  return useMemo(() => {
    if (!data?.data?.positions) return new Set<string>()
    return new Set(Object.values(data.data.positions).map((p) => p.asset.id))
  }, [data])
}
