import type { Portfolio } from "./portfolio"
import type { SystemUser } from "./user"

// ============ Portfolio Sharing ============

export type ShareAccessLevel = "VIEW" | "FULL"

export type ShareStatus =
  "PENDING_CLIENT_INVITE" | "PENDING_ADVISER_REQUEST" | "ACTIVE" | "REVOKED"

export interface PortfolioShare {
  id: string
  portfolio?: Portfolio
  sharedWith: SystemUser
  accessLevel: ShareAccessLevel
  status: ShareStatus
  createdAt: string
  createdBy: SystemUser
  targetUser?: SystemUser
  acceptedAt?: string
}

export interface PendingSharesResponse {
  invites: PortfolioShare[]
  requests: PortfolioShare[]
}

export type ShareResourceType = "INDEPENDENCE_PLAN" | "REBALANCE_MODEL"

export interface ResourceShare {
  id: string
  resourceType: ShareResourceType
  resourceId: string
  resourceName?: string
  sharedWith: SystemUser
  accessLevel: ShareAccessLevel
  status: ShareStatus
  createdAt: string
  createdBy: SystemUser
  resourceOwner: SystemUser
  targetUser?: SystemUser
  acceptedAt?: string
}

export interface PendingResourceSharesResponse {
  invites: ResourceShare[]
  requests: ResourceShare[]
}

/**
 * Response from `GET /resource-shares/managed/{resourceType}` — active
 * shares the current user has accepted for that resource type.
 */
export interface ResourceSharesResponse {
  data: ResourceShare[]
}
