/**
 * Browser-side calls for the signed-in user's own account: settings
 * (`/api/me`), tax rates and offboarding.
 *
 * Keys double as SWR cache keys: keep them byte-identical. Request functions
 * return the raw `Response`, so each caller keeps its own error wording.
 */
import { jsonInit } from "@utils/api/client/request"

// User settings
export const meKey = "/api/me"

export function getMe(): Promise<Response> {
  return fetch(meKey)
}

export function updateMe(request: unknown): Promise<Response> {
  return fetch(meKey, jsonInit("PATCH", request))
}

// Tax rates
export const taxRatesKey = "/api/tax-rates"

export function getTaxRates(): Promise<Response> {
  return fetch(taxRatesKey)
}

export function saveTaxRate(request: unknown): Promise<Response> {
  return fetch(taxRatesKey, jsonInit("POST", request))
}

export function deleteTaxRate(countryCode: string): Promise<Response> {
  return fetch(`${taxRatesKey}/${countryCode}`, { method: "DELETE" })
}

// Offboarding
const offboardBase = "/api/offboard"
export const offboardSummaryUrl = `${offboardBase}/summary`
export type OffboardScope =
  "wealth" | "plans" | "models" | "conversations" | "account"

export function getOffboardSummary(): Promise<Response> {
  return fetch(offboardSummaryUrl)
}

/** DELETE `/api/offboard/{scope}`: removes that slice of the user's data. */
export function deleteOffboardData(scope: OffboardScope): Promise<Response> {
  return fetch(`${offboardBase}/${scope}`, { method: "DELETE" })
}
