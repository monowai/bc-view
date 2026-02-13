import React, { useState } from "react"
import useSwr from "swr"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { PortfolioShare, PendingSharesResponse } from "types/beancounter"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import {
  fetcher,
  sharesManagedKey,
  sharesPendingKey,
} from "@utils/api/fetchHelper"

interface ManagedSharesResponse {
  data: PortfolioShare[]
}
import { rootLoader } from "@components/ui/PageLoader"
import PendingSharesPanel from "./PendingSharesPanel"
import RequestAccessDialog from "./RequestAccessDialog"

export default function ManagedPortfolios(): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()
  const [showRequestDialog, setShowRequestDialog] = useState(false)

  const {
    data: managedResponse,
    error: managedError,
    mutate: mutateManaged,
  } = useSwr<ManagedSharesResponse>(sharesManagedKey, fetcher)

  const {
    data: pending,
    error: pendingError,
    mutate: mutatePending,
  } = useSwr<PendingSharesResponse>(sharesPendingKey, fetcher, {
    refreshInterval: 300000,
  })

  const handlePendingAction = (): void => {
    mutatePending()
    mutateManaged()
  }

  const handleRequestSuccess = (): void => {
    setShowRequestDialog(false)
    mutatePending()
  }

  if (managedError || pendingError) {
    return <div className="p-4 text-red-600">{t("shares.request.error")}</div>
  }

  if (!managedResponse || !pending) {
    return rootLoader(t("loading"))
  }

  const managed = managedResponse.data
  const activeShares = managed.filter(
    (s: PortfolioShare) => s.status === "ACTIVE",
  )

  return (
    <div className="px-4 py-4">
      <PendingSharesPanel pending={pending} onAction={handlePendingAction} />

      {activeShares.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-users text-2xl text-gray-400"></i>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t("shares.managed.empty")}
          </h3>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            {t("shares.managed.empty.hint")}
          </p>
          <button
            onClick={() => setShowRequestDialog(true)}
            className="bg-wealth-500 text-white px-4 py-2 rounded-lg hover:bg-wealth-600 transition-colors"
          >
            <i className="fas fa-hand-paper mr-2"></i>
            {t("shares.request.title")}
          </button>
        </div>
      )}

      {activeShares.length > 0 && (
        <div className="space-y-3">
          {/* Action bar */}
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowRequestDialog(true)}
              className="text-sm text-wealth-600 hover:text-wealth-700 font-medium"
            >
              <i className="fas fa-plus mr-1"></i>
              {t("shares.request.title")}
            </button>
          </div>

          {/* Managed portfolio cards */}
          {activeShares.map((share) => (
            <div
              key={share.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 cursor-pointer hover:border-wealth-200 hover:shadow-md transition-all"
              onClick={() => {
                if (share.portfolio?.code) {
                  router.push(`/holdings/${share.portfolio.code}`)
                }
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-wealth-600">
                      {share.portfolio?.code || "N/A"}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {share.accessLevel === "VIEW"
                        ? t("shares.invite.accessLevel.view")
                        : t("shares.invite.accessLevel.full")}
                    </span>
                  </div>
                  <div className="text-gray-900 mt-1">
                    {share.portfolio?.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t("shares.managed.owner")}:{" "}
                    {share.portfolio?.owner?.email
                      ? maskEmail(share.portfolio.owner.email)
                      : "Owner"}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {share.acceptedAt && (
                    <span className="text-xs text-gray-400">
                      {t("shares.managed.since")}{" "}
                      {new Date(share.acceptedAt).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" },
                      )}
                    </span>
                  )}
                  <RevokeButton
                    shareId={share.id}
                    onRevoked={handlePendingAction}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showRequestDialog && (
        <RequestAccessDialog
          onClose={() => setShowRequestDialog(false)}
          onSuccess={handleRequestSuccess}
        />
      )}
    </div>
  )
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain) return email
  const masked =
    local.length > 2 ? local[0] + "***" + local[local.length - 1] : "***"
  return `${masked}@${domain}`
}

function RevokeButton({
  shareId,
  onRevoked,
}: {
  shareId: string
  onRevoked: () => void
}): React.ReactElement {
  const { t } = useTranslation("common")
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleRevoke = async (): Promise<void> => {
    setShowConfirm(false)
    setIsLoading(true)
    try {
      await fetch(`/api/shares/${shareId}`, { method: "DELETE" })
      onRevoked()
    } catch {
      // silently handle
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowConfirm(true)
        }}
        disabled={isLoading}
        className="text-gray-400 hover:text-red-500 transition-colors p-1"
        title={t("shares.managed.revoke")}
      >
        <i
          className={`fas ${isLoading ? "fa-spinner fa-spin" : "fa-times-circle"}`}
        ></i>
      </button>
      {showConfirm && (
        <ConfirmDialog
          title={t("shares.managed.revoke", "Revoke Access")}
          message={t(
            "shares.managed.revoke.confirm",
            "Are you sure you want to revoke this share?",
          )}
          confirmLabel={t("shares.managed.revoke", "Revoke")}
          cancelLabel={t("cancel", "Cancel")}
          variant="red"
          onConfirm={handleRevoke}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}
