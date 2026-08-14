import useSwr from "swr"
import { simpleFetcher, modelsKey } from "@utils/api/fetchHelper"
import { ModelDto } from "types/rebalance"

export interface UseApprovedModelsResult {
  models: ModelDto[]
  /** Models with a current plan that is actually APPROVED (#1157) — see
   *  {@link isPlanApproved} for the gate. */
  approvedModels: ModelDto[]
  isLoading: boolean
}

/**
 * Whether `model`'s current plan is approved and safe to build an execution
 * against (#1157) — gated on plan *status*, not merely the presence of a
 * currentPlanId/Version. `currentPlanId` is still required (a status with
 * no id is useless). A missing `currentPlanStatus` (stale cache predating
 * svc-rebalance #55) is treated as approved rather than hiding/blocking —
 * the backend has only ever pointed `currentPlanId` at an APPROVED plan, so
 * an absent field can't represent a DRAFT plan today. Any OTHER value
 * (including a future/unexpected status this client doesn't yet know
 * about) is deliberately NOT treated as approved — strict equality only,
 * no `!== "DRAFT"` catch-all that would silently trust it. Single source of
 * truth shared by useApprovedModels (below) and RebalanceWizardContainer's
 * hasApprovedPlan, so the two never drift apart.
 */
export function isPlanApproved(model: ModelDto): boolean {
  return (
    Boolean(model.currentPlanId) &&
    (model.currentPlanStatus === "APPROVED" ||
      model.currentPlanStatus === null ||
      model.currentPlanStatus === undefined)
  )
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
  const approvedModels = models.filter(isPlanApproved)
  return { models, approvedModels, isLoading }
}
