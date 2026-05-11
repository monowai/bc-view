import useSWR from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"

interface AssetValuesResponse {
  data: Record<string, number>
  currency?: string
}

interface UseAssetValuesResult {
  /** Map of assetId → current market value summed across the user's portfolios. */
  values: Record<string, number>
  /** Currency the values are expressed in, when known. */
  currency: string | undefined
  isLoading: boolean
  error: Error | undefined
}

/**
 * Per-asset current market values from svc-retire's `/assets/values`
 * endpoint. Used by the AssetDisposal wizard's holdings picker to
 * autofill `currentValue` when the user selects a tracked asset.
 *
 * One fetch on mount, cached by SWR. Pass `targetCurrency` to receive
 * values pre-converted by svc-position; otherwise each portfolio's
 * native currency is summed naively (avoid for mixed-currency users).
 */
export function useAssetValues(targetCurrency?: string): UseAssetValuesResult {
  const url = targetCurrency
    ? `/api/assets/values?currency=${encodeURIComponent(targetCurrency)}`
    : "/api/assets/values"

  const { data, error, isLoading } = useSWR<AssetValuesResponse>(
    url,
    simpleFetcher(url),
  )

  return {
    values: data?.data || {},
    currency: data?.currency,
    isLoading,
    error,
  }
}
