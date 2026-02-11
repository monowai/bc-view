import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import Dialog from "@components/ui/Dialog"
import { Portfolio, ShareAccessLevel } from "types/beancounter"

interface ShareInviteDialogProps {
  portfolios: Portfolio[]
  preSelectedPortfolioId?: string
  onClose: () => void
  onSuccess: () => void
}

export default function ShareInviteDialog({
  portfolios,
  preSelectedPortfolioId,
  onClose,
  onSuccess,
}: ShareInviteDialogProps): React.ReactElement {
  const { t } = useTranslation("common")
  const [email, setEmail] = useState("")
  const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<Set<string>>(
    preSelectedPortfolioId ? new Set([preSelectedPortfolioId]) : new Set(),
  )
  const [accessLevel, setAccessLevel] = useState<ShareAccessLevel>("VIEW")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const togglePortfolio = (id: string): void => {
    setSelectedPortfolioIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSubmit = async (): Promise<void> => {
    setError(null)
    setSuccess(null)

    if (!email.trim()) {
      setError(t("shares.invite.error"))
      return
    }
    if (selectedPortfolioIds.size === 0) {
      setError(t("shares.invite.error"))
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/shares/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adviserEmail: email.trim(),
          portfolioIds: Array.from(selectedPortfolioIds),
          accessLevel,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error || t("shares.invite.error"))
        return
      }
      setSuccess(t("shares.invite.success"))
      setTimeout(() => {
        onSuccess()
      }, 1500)
    } catch {
      setError(t("shares.invite.error"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = email.trim().length > 0 && selectedPortfolioIds.size > 0

  return (
    <Dialog
      title={t("shares.invite.title")}
      onClose={onClose}
      maxWidth="md"
      scrollable
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={t("cancel")} />
          <Dialog.SubmitButton
            onClick={handleSubmit}
            label={t("shares.invite.submit")}
            loadingLabel={t("shares.invite.sending")}
            isSubmitting={isSubmitting}
            disabled={!canSubmit}
            variant="blue"
          />
        </>
      }
    >
      <Dialog.ErrorAlert message={error} />
      <Dialog.SuccessAlert message={success} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("shares.invite.email")}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("shares.invite.email.placeholder")}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("shares.invite.accessLevel")}
        </label>
        <div className="flex space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              checked={accessLevel === "VIEW"}
              onChange={() => setAccessLevel("VIEW")}
              className="text-blue-600"
            />
            <span className="text-sm">
              {t("shares.invite.accessLevel.view")}
            </span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              checked={accessLevel === "FULL"}
              onChange={() => setAccessLevel("FULL")}
              className="text-blue-600"
            />
            <span className="text-sm">
              {t("shares.invite.accessLevel.full")}
            </span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t("shares.invite.selectPortfolios")}
        </label>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {portfolios.map((p) => (
            <label
              key={p.id}
              className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedPortfolioIds.has(p.id)}
                onChange={() => togglePortfolio(p.id)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300"
              />
              <span className="font-medium text-wealth-600">{p.code}</span>
              <span className="text-gray-600 text-sm">{p.name}</span>
            </label>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
