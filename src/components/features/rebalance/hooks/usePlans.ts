import { plansKey } from "@utils/api/fetchHelper"
import { RebalancePlanSummaryDto } from "types/rebalance"
import { useRebalanceList, UseListResult } from "./useRebalanceData"

export interface UsePlansResult extends UseListResult<RebalancePlanSummaryDto> {
  plans: RebalancePlanSummaryDto[]
}

export function usePlans(): UsePlansResult {
  const result = useRebalanceList<RebalancePlanSummaryDto>(plansKey)
  return {
    ...result,
    plans: result.data,
  }
}
