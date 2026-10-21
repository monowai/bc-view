import { PlanDto } from "types/rebalance"
import { useRebalanceList, UseListResult } from "./useRebalanceData"
import { modelPlansKey } from "@utils/api/client/rebalance"

export interface UseModelPlansResult extends UseListResult<PlanDto> {
  plans: PlanDto[]
}

export function useModelPlans(
  modelId: string | undefined,
): UseModelPlansResult {
  const key = modelId ? modelPlansKey(modelId) : null
  const result = useRebalanceList<PlanDto>(key)
  return {
    ...result,
    plans: result.data,
  }
}
