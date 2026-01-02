import { executionsKey } from "@utils/api/fetchHelper"
import { ExecutionSummaryDto } from "types/rebalance"
import { useRebalanceList, UseListResult } from "./useRebalanceData"

export interface UseExecutionsResult extends UseListResult<ExecutionSummaryDto> {
  executions: ExecutionSummaryDto[]
}

export function useExecutions(): UseExecutionsResult {
  const result = useRebalanceList<ExecutionSummaryDto>(executionsKey)
  return {
    ...result,
    executions: result.data,
  }
}
