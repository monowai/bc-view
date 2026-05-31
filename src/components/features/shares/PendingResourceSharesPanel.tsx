import React, { useState } from "react"
import {
  PendingResourceSharesResponse,
  ResourceShare,
  ShareResourceType,
} from "types/beancounter"

interface PendingResourceSharesPanelProps {
  pending: PendingResourceSharesResponse
  /**
   * When set, only invites/requests for this resource type are rendered.
   * Lets each owning page (Independence / Rebalance) surface only its own
   * pending shares without leaking the other type.
   */
  resourceType?: ShareResourceType
  onAction: () => void
}

const typeLabel = (t: ShareResourceType): string =>
  t === "INDEPENDENCE_PLAN" ? "Plan" : "Model"

export default function PendingResourceSharesPanel({
  pending,
  resourceType,
  onAction,
}: PendingResourceSharesPanelProps): React.ReactElement | null {
  const invites = resourceType
    ? pending.invites.filter((s) => s.resourceType === resourceType)
    : pending.invites
  const requests = resourceType
    ? pending.requests.filter((s) => s.resourceType === resourceType)
    : pending.requests

  if (invites.length === 0 && requests.length === 0) {
    return null
  }

  const invitationsHeader = resourceType
    ? `${typeLabel(resourceType)} Invitations for You`
    : "Invitations for You"
  const requestsHeader = resourceType
    ? `Requests for Your ${typeLabel(resourceType)}s`
    : "Requests for Your Resources"

  return (
    <div className="space-y-4 mb-6">
      {invites.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">
            <i className="fas fa-envelope-open mr-2"></i>
            {invitationsHeader}
          </h3>
          <div className="space-y-2">
            {invites.map((share) => (
              <PendingResourceShareRow
                key={share.id}
                share={share}
                label={share.createdBy.email || "Unknown"}
                onAction={onAction}
              />
            ))}
          </div>
        </div>
      )}

      {requests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-3">
            <i className="fas fa-hand-paper mr-2"></i>
            {requestsHeader}
          </h3>
          <div className="space-y-2">
            {requests.map((share) => (
              <PendingResourceShareRow
                key={share.id}
                share={share}
                label={share.createdBy.email || "Unknown"}
                onAction={onAction}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface PendingResourceShareRowProps {
  share: ResourceShare
  label: string
  onAction: () => void
}

function PendingResourceShareRow({
  share,
  label,
  onAction,
}: PendingResourceShareRowProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runAction = async (
    url: string,
    method: "POST" | "DELETE",
    failureMessage: string,
  ): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(url, { method })
      if (!res.ok) {
        setError(`${failureMessage} (${res.status})`)
        return
      }
      onAction()
    } catch (err) {
      setError(err instanceof Error ? err.message : failureMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccept = (): Promise<void> =>
    runAction(
      `/api/resource-shares/${share.id}/accept`,
      "POST",
      "Failed to accept invitation",
    )

  const handleDecline = (): Promise<void> =>
    runAction(
      `/api/resource-shares/${share.id}`,
      "DELETE",
      "Failed to decline invitation",
    )

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            <span className="text-wealth-600 mr-2">
              {typeLabel(share.resourceType)}
            </span>
            {share.resourceName || share.resourceId}
          </div>
          <div className="text-xs text-gray-500">
            {"From"}: {label}
            <span className="ml-2 text-gray-400">
              {share.accessLevel === "VIEW" ? "View Only" : "Full Access"}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-3">
          <button
            onClick={handleAccept}
            disabled={isLoading}
            className="bg-green-500 text-white text-xs px-3 py-1.5 rounded hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            {"Accept"}
          </button>
          <button
            onClick={handleDecline}
            disabled={isLoading}
            className="bg-gray-300 text-gray-700 text-xs px-3 py-1.5 rounded hover:bg-gray-400 transition-colors disabled:opacity-50"
          >
            {"Decline"}
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
