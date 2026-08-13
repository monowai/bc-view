import useSwr from "swr"
import { simpleFetcher, modelsKey } from "@utils/api/fetchHelper"
import { ModelDto } from "types/rebalance"

export interface UseApprovedModelsResult {
  models: ModelDto[]
  /** Models with an approved current plan. Filter kept verbatim
   *  (`currentPlanId && currentPlanVersion`) — a later PR switches this to
   *  plan status. */
  approvedModels: ModelDto[]
  isLoading: boolean
}

/**
 * Fetches the model list — gated by `enabled` (typically a dialog's
 * modalOpen flag, so it doesn't fetch until opened) — and derives the
 * subset with an approved current plan. Shared by SelectPlanDialog and
 * InvestCashDialog, which both need "models I can pick a plan from."
 */
export function useApprovedModels(enabled: boolean): UseApprovedModelsResult {
  const { data, isLoading } = useSwr(
    enabled ? modelsKey : null,
    simpleFetcher(modelsKey),
  )
  const models: ModelDto[] = data?.data || []
  const approvedModels = models.filter(
    (m) => m.currentPlanId && m.currentPlanVersion,
  )
  return { models, approvedModels, isLoading }
}
