/**
 * Browser-side calls to the independence API (`/api/independence/...`,
 * svc-retire), plus the lump-sum projection (`/api/projection/lump-sum`).
 *
 * Keys double as SWR cache keys: keep them byte-identical, since
 * `mutate(key)` elsewhere relies on the exact string. Request functions own
 * the URL, method, headers and body and return the raw `Response`, so each
 * caller keeps its own error wording.
 */
import { jsonInit } from "@utils/api/client/request"

const base = "/api/independence"

// Plans (phases)
export const plansKey = `${base}/plans`
export const planKey = (planId: string): string => `${plansKey}/${planId}`
export const planDetailsKey = (planId: string): string =>
  `${planKey(planId)}/details`
export const planExpensesKey = (planId: string): string =>
  `${planKey(planId)}/expenses`
export const planExpenseUrl = (planId: string, expenseId: string): string =>
  `${planExpensesKey(planId)}/${expenseId}`
export const planPropertiesKey = (planId: string): string =>
  `${planKey(planId)}/properties`

/** The user's journeys (IndependencePlan). */
export const independencePlansKey = `${base}/independence-plans`

// Work scenarios
export const workScenariosKey = `${base}/work-scenarios`
export const workScenarioKey = (scenarioId: string): string =>
  `${workScenariosKey}/${scenarioId}`
export const deletedWorkScenariosKey = `${workScenariosKey}/deleted`
export const workScenarioContributionsKey = (scenarioId: string): string =>
  `${workScenarioKey(scenarioId)}/contributions`

export const independenceSettingsKey = `${base}/settings`
export const expenseCategoriesKey = `${base}/categories`
export const independenceScenariosKey = `${base}/scenarios`
export const lifestyleCatalogKey = (currency?: string): string =>
  currency
    ? `${base}/lifestyle-catalog?currency=${encodeURIComponent(currency)}`
    : `${base}/lifestyle-catalog`

// Projections
export const projectionKey = (planId: string): string =>
  `${base}/projection/${planId}`
export const monteCarloUrl = (planId: string): string =>
  `${projectionKey(planId)}/monte-carlo`
export const definedContributionKey = (salary: number, age: number): string =>
  `${base}/projection/defined-contribution?salary=${salary}&age=${age}`
export const compositeProjectionUrl = `${base}/composite/projection`
export const compositeScenariosUrl = `${base}/composite/scenarios`
export const compositeMonteCarloUrl = `${base}/composite/monte-carlo`
export const lumpSumProjectionUrl = "/api/projection/lump-sum"

// CPF
export const cpfContributionPreviewKey = (
  monthlySalary: number,
  age: number,
): string =>
  `${base}/cpf/contribution-preview?monthlySalary=${monthlySalary}&age=${age}`
/** Base URL; the caller appends the query string. */
export const cpfBalanceSeriesUrl = `${base}/cpf/balance-series`
/** Base URL; the caller appends the query string. */
export const cpfPolicyBalanceSeriesUrl = `${base}/cpf/policy-balance-series`

export function getPlans(): Promise<Response> {
  return fetch(plansKey)
}

export function createPlan(request: unknown): Promise<Response> {
  return fetch(plansKey, jsonInit("POST", request))
}

/** PATCH replaces the whole plan: send every field, not a delta. */
export function updatePlan(
  planId: string,
  request: unknown,
): Promise<Response> {
  return fetch(planKey(planId), jsonInit("PATCH", request))
}

export function deletePlan(planId: string): Promise<Response> {
  return fetch(planKey(planId), { method: "DELETE" })
}

export function exportPlan(planId: string): Promise<Response> {
  return fetch(`${planKey(planId)}/export`)
}

export function importPlan(planData: unknown): Promise<Response> {
  return fetch(`${plansKey}/import`, jsonInit("POST", planData))
}

export function copyPlan(planId: string, name: string): Promise<Response> {
  return fetch(`${planKey(planId)}/copy`, jsonInit("POST", { name }))
}

export function setPrimaryPlan(planId: string): Promise<Response> {
  return fetch(`${planKey(planId)}/primary`, { method: "POST" })
}

export function transferPlan(planId: string): Promise<Response> {
  return fetch(`${planKey(planId)}/transfer`, { method: "POST" })
}

/** URL for generating a plan's phases; `fetch`-injectable callers use it. */
export const planPhasesUrl = (planId: string): string =>
  `${planKey(planId)}/phases`

export function generatePlanPhases(
  planId: string,
  request: unknown,
): Promise<Response> {
  return fetch(planPhasesUrl(planId), jsonInit("POST", request))
}

export function getPlanExpenses(planId: string): Promise<Response> {
  return fetch(planExpensesKey(planId))
}

export function createPlanExpense(
  planId: string,
  expense: unknown,
): Promise<Response> {
  return fetch(planExpensesKey(planId), jsonInit("POST", expense))
}

export function deletePlanExpense(
  planId: string,
  expenseId: string,
): Promise<Response> {
  return fetch(planExpenseUrl(planId, expenseId), { method: "DELETE" })
}

export function createPlanProperty(
  planId: string,
  request: unknown,
): Promise<Response> {
  return fetch(planPropertiesKey(planId), jsonInit("POST", request))
}

export function deletePlanProperty(
  planId: string,
  assetId: string,
): Promise<Response> {
  return fetch(`${planPropertiesKey(planId)}/${encodeURIComponent(assetId)}`, {
    method: "DELETE",
  })
}

export function getWorkScenarios(): Promise<Response> {
  return fetch(workScenariosKey)
}

export function createWorkScenario(request: unknown): Promise<Response> {
  return fetch(workScenariosKey, jsonInit("POST", request))
}

export function updateWorkScenario(
  scenarioId: string,
  request: unknown,
): Promise<Response> {
  return fetch(workScenarioKey(scenarioId), jsonInit("PATCH", request))
}

export function saveWorkScenarioContributions(
  scenarioId: string,
  request: unknown,
): Promise<Response> {
  return fetch(
    workScenarioContributionsKey(scenarioId),
    jsonInit("POST", request),
  )
}

export function updateIndependenceSettings(
  request: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(independenceSettingsKey, {
    ...jsonInit("PATCH", request),
    ...(signal ? { signal } : {}),
  })
}

export function runProjection(
  planId: string,
  request: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(projectionKey(planId), {
    ...jsonInit("POST", request),
    ...(signal ? { signal } : {}),
  })
}

export function runMonteCarlo(
  planId: string,
  request: unknown,
): Promise<Response> {
  return fetch(monteCarloUrl(planId), jsonInit("POST", request))
}

export function runCompositeProjection(request: unknown): Promise<Response> {
  return fetch(compositeProjectionUrl, jsonInit("POST", request))
}

export function runCompositeScenarios(request: unknown): Promise<Response> {
  return fetch(compositeScenariosUrl, jsonInit("POST", request))
}

export function runCompositeMonteCarlo(request: unknown): Promise<Response> {
  return fetch(compositeMonteCarloUrl, jsonInit("POST", request))
}

export function projectLumpSum(request: unknown): Promise<Response> {
  return fetch(lumpSumProjectionUrl, jsonInit("POST", request))
}
