import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { PlanResponse, PlanDto } from "types/rebalance"

export interface UseModelPlanResult {
  plan: PlanDto | undefined
  error: Error | undefined
  isLoading: boolean
  mutate: () => void
}

export function useModelPlan(
  modelId: string | undefined,
  planId: string | undefined,
): UseModelPlanResult {
  const key =
    modelId && planId
      ? `/api/rebalance/models/${modelId}/plans/${planId}`
      : null
  const { data, error, isLoading, mutate } = useSwr<PlanResponse>(
    key,
    key ? simpleFetcher(key) : null,
  )
  return {
    plan: data?.data,
    error,
    isLoading,
    mutate,
  }
}
