import { PlanDto } from "types/rebalance"
import { useRebalanceItem, UseDataResult } from "./useRebalanceData"
import { modelPlanKey } from "@utils/api/client/rebalance"

export interface UseModelPlanResult extends UseDataResult<PlanDto> {
  plan: PlanDto | undefined
}

export function useModelPlan(
  modelId: string | undefined,
  planId: string | undefined,
): UseModelPlanResult {
  const key = modelId && planId ? modelPlanKey(modelId, planId) : null
  const result = useRebalanceItem<PlanDto>(key)
  return {
    ...result,
    plan: result.data,
  }
}
