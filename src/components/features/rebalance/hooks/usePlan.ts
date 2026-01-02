import { useEffect, useState } from "react"
import useSwr from "swr"
import { planKey, simpleFetcher } from "@utils/api/fetchHelper"
import { RebalancePlanDto, PlanItemDto } from "types/rebalance"
import { Asset } from "types/beancounter"

export interface UsePlanResult {
  plan: RebalancePlanDto | undefined
  error: Error | undefined
  isLoading: boolean
  mutate: () => void
}

// Cache for asset lookups to avoid repeated fetches
const assetCache: Record<string, { code: string; name: string }> = {}

async function fetchAssetDetails(assetId: string): Promise<{ code: string; name: string } | null> {
  if (assetCache[assetId]) {
    return assetCache[assetId]
  }

  try {
    const response = await fetch(`/api/assets/${assetId}`)
    if (response.ok) {
      const data = await response.json()
      const asset: Asset = data.data || data
      const details = { code: asset.code, name: asset.name }
      assetCache[assetId] = details
      return details
    }
  } catch {
    // Silently fail - we'll just show the ID
  }
  return null
}

function enrichPlanItems(items: PlanItemDto[]): Promise<PlanItemDto[]> {
  return Promise.all(
    items.map(async (item) => {
      if (item.assetCode && item.assetName) {
        return item // Already enriched
      }
      const details = await fetchAssetDetails(item.assetId)
      if (details) {
        return {
          ...item,
          assetCode: item.assetCode || details.code,
          assetName: item.assetName || details.name,
        }
      }
      return item
    }),
  )
}

export function usePlan(planId: string | undefined): UsePlanResult {
  const key = planId ? planKey(planId) : null
  const { data, error, isLoading, mutate } = useSwr<{ data: RebalancePlanDto }>(
    key,
    key ? simpleFetcher(key) : null,
  )

  const [enrichedPlan, setEnrichedPlan] = useState<RebalancePlanDto | undefined>(undefined)

  useEffect(() => {
    if (data?.data?.items) {
      enrichPlanItems(data.data.items).then((enrichedItems) => {
        setEnrichedPlan({
          ...data.data,
          items: enrichedItems,
        })
      })
    } else {
      setEnrichedPlan(data?.data)
    }
  }, [data])

  return {
    plan: enrichedPlan,
    error,
    isLoading,
    mutate,
  }
}
