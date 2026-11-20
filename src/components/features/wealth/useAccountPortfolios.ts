import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { assetPositionsKey } from "@utils/api/client/assets"

export interface HoldingPortfolio {
  id: string
  code: string
}

/**
 * The portfolios that hold an asset, from the asset's "where held" lookup.
 * A withdrawal from a bank account is posted into one of them.
 */
export function useAccountPortfolios(assetId: string): {
  portfolios: HoldingPortfolio[]
  isLoading: boolean
  /** The lookup failed: where the asset is held is unknown, not "nowhere". */
  failed: boolean
} {
  const key = assetId ? assetPositionsKey(assetId) : null
  const { data, isLoading, error } = useSwr<{
    data?: Array<{ portfolio?: HoldingPortfolio }>
  }>(key, key ? simpleFetcher(key) : null)
  const portfolios = (data?.data ?? [])
    .map((p) => p.portfolio)
    .filter((p): p is HoldingPortfolio => p !== undefined)
    .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i)
  const failed = key !== null && error !== undefined
  return {
    portfolios,
    isLoading: key !== null && !failed && (isLoading || !data),
    failed,
  }
}
