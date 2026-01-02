import { modelKey } from "@utils/api/fetchHelper"
import { ModelDto } from "types/rebalance"
import { useRebalanceItem, UseDataResult } from "./useRebalanceData"

export interface UseModelResult extends UseDataResult<ModelDto> {
  model: ModelDto | undefined
}

export function useModel(modelId: string | undefined): UseModelResult {
  const key = modelId ? modelKey(modelId) : null
  const result = useRebalanceItem<ModelDto>(key)
  return {
    ...result,
    model: result.data,
  }
}
