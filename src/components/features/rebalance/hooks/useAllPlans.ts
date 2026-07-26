import useSwr, { KeyedMutator } from "swr"
import { ModelDto, PlanDto, PlansResponse } from "types/rebalance"
import { useModels } from "./useModels"

export interface UseAllPlansResult {
  plans: PlanDto[]
  isLoading: boolean
  error: Error | undefined
  mutate: KeyedMutator<PlanDto[]>
}

async function fetchPlansForModel(model: ModelDto): Promise<PlanDto[]> {
  const response = await fetch(`/api/rebalance/models/${model.id}/plans`)
  if (!response.ok) {
    throw new Error(`Failed to load plans for model ${model.id}`)
  }
  const body: PlansResponse = await response.json()
  return body.data
}

async function fetchAllPlans(models: ModelDto[]): Promise<PlanDto[]> {
  const perModel = await Promise.all(models.map(fetchPlansForModel))
  return perModel.flat()
}

/**
 * Aggregates rebalance plans across every model the caller can see.
 *
 * svc-rebalance has no top-level "list all plans" endpoint — PlanController
 * only exposes plans nested under a model (`/models/{modelId}/plans`) — so
 * this hook fans out one request per model (via the working
 * `/api/rebalance/models/{modelId}/plans` proxy) and merges the results
 * client-side. Each `PlanDto` already carries `modelId`/`modelName`, so
 * callers can link straight to `/rebalance/models/{modelId}/plans/{planId}`.
 */
export function useAllPlans(): UseAllPlansResult {
  const { models, isLoading: modelsLoading, error: modelsError } = useModels()

  const modelIds = models.map((model) => model.id).join(",")
  const swrKey = modelsLoading ? null : `rebalance-all-plans:${modelIds}`

  const {
    data,
    error: plansError,
    isLoading: plansLoading,
    mutate,
  } = useSwr<PlanDto[]>(swrKey, () => fetchAllPlans(models))

  return {
    plans: data || [],
    isLoading: modelsLoading || (swrKey !== null && plansLoading),
    error: modelsError || plansError,
    mutate,
  }
}
