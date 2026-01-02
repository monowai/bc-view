import { modelsKey } from "@utils/api/fetchHelper"
import { ModelDto } from "types/rebalance"
import { useRebalanceList, UseListResult } from "./useRebalanceData"

export interface UseModelsResult extends UseListResult<ModelDto> {
  models: ModelDto[]
}

export function useModels(): UseModelsResult {
  const result = useRebalanceList<ModelDto>(modelsKey)
  return {
    ...result,
    models: result.data,
  }
}
