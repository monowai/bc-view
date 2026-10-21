/**
 * Browser-side calls for sharing: portfolio shares with an adviser
 * (`/api/shares/...`) and resource shares of plans and models
 * (`/api/resource-shares/...`).
 *
 * Keys double as SWR cache keys: keep them byte-identical. Request functions
 * return the raw `Response`, so each caller keeps its own error wording.
 */
import { jsonInit } from "@utils/api/client/request"

const sharesBase = "/api/shares"
const resourceSharesBase = "/api/resource-shares"

export const sharesPendingKey = `${sharesBase}/pending`
export const sharesManagedKey = `${sharesBase}/managed`
export const sharesGrantedKey = `${sharesBase}/granted`
const shareUrl = (shareId: string): string => `${sharesBase}/${shareId}`

export const resourceSharesPendingKey = `${resourceSharesBase}/pending`
export const resourceSharesManagedKey = (resourceType: string): string =>
  `${resourceSharesBase}/managed/${resourceType}`
export const grantedResourceSharesKey = (resourceType: string): string =>
  `${resourceSharesBase}/granted/${resourceType}`
export const resourceShareUrl = (shareId: string): string =>
  `${resourceSharesBase}/${shareId}`

export function acceptShare(shareId: string): Promise<Response> {
  return fetch(`${shareUrl(shareId)}/accept`, { method: "POST" })
}

/** DELETE a share: revoke, decline or leave it. */
export function revokeShare(shareId: string): Promise<Response> {
  return fetch(shareUrl(shareId), { method: "DELETE" })
}

/** A client invites an adviser to their portfolios. */
export function inviteAdviser(request: unknown): Promise<Response> {
  return fetch(`${sharesBase}/invite`, jsonInit("POST", request))
}

/** An adviser asks a client for access. */
export function requestShareAccess(request: unknown): Promise<Response> {
  return fetch(`${sharesBase}/request`, jsonInit("POST", request))
}

export function inviteResourceShare(request: unknown): Promise<Response> {
  return fetch(`${resourceSharesBase}/invite`, jsonInit("POST", request))
}

/** DELETE a resource share: revoke, decline or leave it. */
export function revokeResourceShare(shareId: string): Promise<Response> {
  return fetch(resourceShareUrl(shareId), { method: "DELETE" })
}
