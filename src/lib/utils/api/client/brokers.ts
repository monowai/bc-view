/**
 * Browser-side calls to the brokers API (`/api/brokers/...`, svc-data).
 *
 * Keys double as SWR cache keys: keep them byte-identical. Request functions
 * return the raw `Response`, so each caller keeps its own error wording.
 */
import { jsonInit } from "@utils/api/client/request"

export const brokersKey = "/api/brokers"
export const brokersWithAccountsKey = `${brokersKey}?includeAccounts=true`
export const brokerUrl = (brokerId: string): string =>
  `${brokersKey}/${brokerId}`

export function createBroker(request: unknown): Promise<Response> {
  return fetch(brokersKey, jsonInit("POST", request))
}

export function updateBroker(
  brokerId: string,
  request: unknown,
): Promise<Response> {
  return fetch(brokerUrl(brokerId), jsonInit("PATCH", request))
}

export function deleteBroker(brokerId: string): Promise<Response> {
  return fetch(brokerUrl(brokerId), { method: "DELETE" })
}

/** Move every holding from one broker to another. */
export function transferBrokerHoldings(
  fromBrokerId: string,
  toBrokerId: string,
): Promise<Response> {
  return fetch(`${brokerUrl(fromBrokerId)}/transfer?toBrokerId=${toBrokerId}`, {
    method: "POST",
  })
}
