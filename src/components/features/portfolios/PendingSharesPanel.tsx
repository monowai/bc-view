import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import { PendingSharesResponse, PortfolioShare } from "types/beancounter"

interface PendingSharesPanelProps {
  pending: PendingSharesResponse
  onAction: () => void
}

export default function PendingSharesPanel({
  pending,
  onAction,
}: PendingSharesPanelProps): React.ReactElement | null {
  const { t } = useTranslation("common")

  if (pending.invites.length === 0 && pending.requests.length === 0) {
    return null
  }

  return (
    <div className="space-y-4 mb-6">
      {pending.invites.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">
            <i className="fas fa-envelope-open mr-2"></i>
            {t("shares.pending.invites")}
          </h3>
          <div className="space-y-2">
            {pending.invites.map((share) => (
              <PendingShareRow
                key={share.id}
                share={share}
                label={share.createdBy.email || "Unknown"}
                onAction={onAction}
              />
            ))}
          </div>
        </div>
      )}

      {pending.requests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-3">
            <i className="fas fa-hand-paper mr-2"></i>
            {t("shares.pending.requests")}
          </h3>
          <div className="space-y-2">
            {pending.requests.map((share) => (
              <PendingShareRow
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

interface PendingShareRowProps {
  share: PortfolioShare
  label: string
  onAction: () => void
}

function PendingShareRow({
  share,
  label,
  onAction,
}: PendingShareRowProps): React.ReactElement {
  const { t } = useTranslation("common")
  const [isLoading, setIsLoading] = useState(false)

  const handleAccept = async (): Promise<void> => {
    setIsLoading(true)
    try {
      await fetch(`/api/shares/${share.id}/accept`, { method: "POST" })
      onAction()
    } catch {
      // error handled silently
    } finally {
      setIsLoading(false)
    }
  }

  const handleDecline = async (): Promise<void> => {
    setIsLoading(true)
    try {
      await fetch(`/api/shares/${share.id}`, { method: "DELETE" })
      onAction()
    } catch {
      // error handled silently
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {share.portfolio?.code && (
            <span className="text-wealth-600 mr-2">{share.portfolio.code}</span>
          )}
          {share.portfolio?.name || "Portfolio"}
        </div>
        <div className="text-xs text-gray-500">
          {t("shares.pending.from")}: {label}
          <span className="ml-2 text-gray-400">
            {share.accessLevel === "VIEW"
              ? t("shares.invite.accessLevel.view")
              : t("shares.invite.accessLevel.full")}
          </span>
        </div>
      </div>
      <div className="flex items-center space-x-2 ml-3">
        <button
          onClick={handleAccept}
          disabled={isLoading}
          className="bg-green-500 text-white text-xs px-3 py-1.5 rounded hover:bg-green-600 transition-colors disabled:opacity-50"
        >
          {t("shares.pending.accept")}
        </button>
        <button
          onClick={handleDecline}
          disabled={isLoading}
          className="bg-gray-300 text-gray-700 text-xs px-3 py-1.5 rounded hover:bg-gray-400 transition-colors disabled:opacity-50"
        >
          {t("shares.pending.decline")}
        </button>
      </div>
    </div>
  )
}
