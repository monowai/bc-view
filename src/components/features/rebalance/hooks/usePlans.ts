import { plansKey } from "@utils/api/fetchHelper"
import { RebalancePlanSummaryDto } from "types/rebalance"
import { useRebalanceList, UseListResult } from "./useRebalanceData"

export interface UsePlansResult extends UseListResult<RebalancePlanSummaryDto> {
  plans: RebalancePlanSummaryDto[]
  deletePlan: (planId: string) => Promise<boolean>
}

export function usePlans(): UsePlansResult {
  const result = useRebalanceList<RebalancePlanSummaryDto>(plansKey)

  const deletePlan = async (planId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/rebalance/plans/${planId}`, {
        method: "DELETE",
      })
      if (response.ok || response.status === 204) {
        await result.mutate()
        return true
      }
      return false
    } catch (err) {
      console.error("Failed to delete plan:", err)
      return false
    }
  }

  return {
    ...result,
    plans: result.data,
    deletePlan,
  }
}
