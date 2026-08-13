import { PlanDto } from "types/rebalance"
import { useRebalanceItem, UseDataResult } from "./useRebalanceData"

export interface UseModelPlanResult extends UseDataResult<PlanDto> {
  plan: PlanDto | undefined
}

export function useModelPlan(
  modelId: string | undefined,
  planId: string | undefined,
): UseModelPlanResult {
  const key =
    modelId && planId
      ? `/api/rebalance/models/${modelId}/plans/${planId}`
      : null
  const result = useRebalanceItem<PlanDto>(key)
  return {
    ...result,
    plan: result.data,
  }
}
