/**
 * Browser-side calls to the brokers API (`/api/brokers/...`, svc-data).
 *
 * Keys double as SWR cache keys: keep them byte-identical. Request functions
 * return the raw `Response`, so each caller keeps its own error wording.
 */
import { jsonInit } from "@utils/api/client/request"
import type {
  ConfirmedHoldings,
  HeldSinceRequest,
  ShownHoldings,
} from "types/beancounter"

export const brokersKey = "/api/brokers"
export const brokersWithAccountsKey = `${brokersKey}?includeAccounts=true`
export const globalBrokersKey = "/api/global-brokers"
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

// ---- Import holdings from a screenshot ----

export const screenshotReadUrl = "/api/agent/screenshot"
export const reconcilePreviewUrl = `${brokersKey}/reconcile`
export const reconcileCommitUrl = `${reconcilePreviewUrl}/commit`
export const heldSinceUrl = `${reconcilePreviewUrl}/held-since`

/**
 * Have a brokerage screenshot read into a `ScreenshotProposal`. Records
 * nothing. Each call is a paid vision-model call: never fire it speculatively.
 */
export function readScreenshot(
  file: File,
  signal?: AbortSignal,
): Promise<Response> {
  const body = new FormData()
  body.append("file", file)
  // No Content-Type: the browser sets it, with the multipart boundary.
  return fetch(screenshotReadUrl, { method: "POST", body, signal })
}

/** Preview what recording the shown holdings would do. Read-only. */
export function previewReconcile(
  shown: ShownHoldings,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(reconcilePreviewUrl, { ...jsonInit("POST", shown), signal })
}

/** Record the confirmed rows. All or nothing; one `uploadId` records once. */
export function commitReconcile(
  confirmed: ConfirmedHoldings,
): Promise<Response> {
  return fetch(reconcileCommitUrl, jsonInit("POST", confirmed))
}

/** When each holding was probably opened, from its cost per share. Records nothing. */
export function suggestHeldSince(request: HeldSinceRequest): Promise<Response> {
  return fetch(heldSinceUrl, jsonInit("POST", request))
}
