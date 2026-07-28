import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import type { LifestyleCatalogResponse } from "types/independence"

/**
 * The lifestyle catalog: per-category tiers, each with an amount, an emoji and
 * a description of what that level of spend buys.
 *
 * svc-retire owns this, converts it to the plan's currency and caches it — so
 * the summary surfaces describe a life using the same tiers the mood board
 * offers, rather than a second set of numbers maintained in the frontend.
 */
export function useLifestyleCatalog(currency: string | undefined): {
  catalog: LifestyleCatalogResponse | undefined
  isLoading: boolean
} {
  const key = currency
    ? `/api/independence/lifestyle-catalog?currency=${encodeURIComponent(currency)}`
    : "/api/independence/lifestyle-catalog"
  const { data, isLoading } = useSwr<LifestyleCatalogResponse>(
    key,
    simpleFetcher(key),
  )
  return { catalog: data, isLoading }
}
