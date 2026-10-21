/**
 * Browser-side calls to the rebalance API (`/api/rebalance/...`,
 * svc-rebalance).
 *
 * Keys double as SWR cache keys: keep them byte-identical, since
 * `mutate(key)` elsewhere relies on the exact string. Request functions own
 * the URL, method, headers and body and return the raw `Response`, so each
 * caller keeps its own error wording.
 */
import { jsonInit } from "@utils/api/client/request"

const base = "/api/rebalance"

export const modelsKey = `${base}/models`
export const executionsKey = `${base}/executions`
export const modelKey = (modelId: string): string => `${modelsKey}/${modelId}`
export const executionKey = (executionId: string): string =>
  `${executionsKey}/${executionId}`
export const modelPlansKey = (modelId: string): string =>
  `${modelKey(modelId)}/plans`
export const modelPlanKey = (modelId: string, planId: string): string =>
  `${modelPlansKey(modelId)}/${planId}`
export const approvedModelPlansUrl = (modelId: string): string =>
  `${modelPlansKey(modelId)}/approved`
export const planPricesUrl = (modelId: string, planId: string): string =>
  `${modelPlanKey(modelId, planId)}/prices`
export const weightsFromHoldingsUrl = (
  modelId: string,
  portfolioId: string,
  valueCurrency: string,
): string =>
  `${modelPlansKey(modelId)}/weights-from-holdings?portfolioId=${portfolioId}&valueCurrency=${valueCurrency}`
/** The models that hold an asset. */
export const assetModelsKey = (assetId: string): string =>
  `${base}/assets/${assetId}/models`

// Models
export function createModel(request: unknown): Promise<Response> {
  return fetch(modelsKey, jsonInit("POST", request))
}

export function updateModel(
  modelId: string,
  request: unknown,
): Promise<Response> {
  return fetch(modelKey(modelId), jsonInit("PUT", request))
}

export function deleteModel(modelId: string): Promise<Response> {
  return fetch(modelKey(modelId), { method: "DELETE" })
}

// Plans
export function createModelPlan(
  modelId: string,
  request: unknown,
): Promise<Response> {
  return fetch(modelPlansKey(modelId), jsonInit("POST", request))
}

export function updateModelPlan(
  modelId: string,
  planId: string,
  request: unknown,
): Promise<Response> {
  return fetch(modelPlanKey(modelId, planId), jsonInit("PUT", request))
}

export function deleteModelPlan(
  modelId: string,
  planId: string,
): Promise<Response> {
  return fetch(modelPlanKey(modelId, planId), { method: "DELETE" })
}

export function approveModelPlan(
  modelId: string,
  planId: string,
): Promise<Response> {
  return fetch(`${modelPlanKey(modelId, planId)}/approve`, { method: "POST" })
}

// Executions
export function getExecution(executionId: string): Promise<Response> {
  return fetch(executionKey(executionId))
}

export function createExecution(request: unknown): Promise<Response> {
  return fetch(executionsKey, jsonInit("POST", request))
}

export function updateExecution(
  executionId: string,
  request: unknown,
): Promise<Response> {
  return fetch(executionKey(executionId), jsonInit("PUT", request))
}

export function deleteExecution(executionId: string): Promise<Response> {
  return fetch(executionKey(executionId), { method: "DELETE" })
}

export function refreshExecution(executionId: string): Promise<Response> {
  return fetch(`${executionKey(executionId)}/refresh`, { method: "POST" })
}

export function commitExecution(
  executionId: string,
  request: unknown,
): Promise<Response> {
  return fetch(`${executionKey(executionId)}/commit`, jsonInit("POST", request))
}
