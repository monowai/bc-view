import { PlanDto } from "types/rebalance"
import { useRebalanceList, UseListResult } from "./useRebalanceData"

export interface UseModelPlansResult extends UseListResult<PlanDto> {
  plans: PlanDto[]
}

export function useModelPlans(
  modelId: string | undefined,
): UseModelPlansResult {
  const key = modelId ? `/api/rebalance/models/${modelId}/plans` : null
  const result = useRebalanceList<PlanDto>(key)
  return {
    ...result,
    plans: result.data,
  }
}
