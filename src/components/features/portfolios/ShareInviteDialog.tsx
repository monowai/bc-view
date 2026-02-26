import React, { useState } from "react"
import Dialog from "@components/ui/Dialog"
import { Portfolio, ShareAccessLevel } from "types/beancounter"
import { useDialogSubmit } from "@hooks/useDialogSubmit"

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
  const [email, setEmail] = useState("")
  const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<Set<string>>(
    preSelectedPortfolioId ? new Set([preSelectedPortfolioId]) : new Set(),
  )
  const [accessLevel, setAccessLevel] = useState<ShareAccessLevel>("VIEW")
  const {
    isSubmitting,
    submitError: error,
    submitSuccess,
    handleSubmit,
    setError,
  } = useDialogSubmit({
    onSuccess,
    autoCloseDelay: 1500,
    fallbackError: "Failed to send invitation",
  })

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

  const onSubmit = async (): Promise<void> => {
    if (!email.trim()) {
      setError("Please enter an email address")
      return
    }
    if (selectedPortfolioIds.size === 0) {
      setError("Please select at least one portfolio")
      return
    }

    await handleSubmit(async () => {
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
        throw new Error(data.error || "Failed to send invitation")
      }
    })
  }

  const canSubmit = email.trim().length > 0 && selectedPortfolioIds.size > 0

  return (
    <Dialog
      title={"Share Portfolios"}
      onClose={onClose}
      maxWidth="md"
      scrollable
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
          <Dialog.SubmitButton
            onClick={onSubmit}
            label={"Send Invite"}
            loadingLabel={"Sending..."}
            isSubmitting={isSubmitting}
            disabled={!canSubmit}
            variant="blue"
          />
        </>
      }
    >
      <Dialog.ErrorAlert message={error} />
      <Dialog.SuccessAlert
        message={submitSuccess ? "Invitation sent successfully" : null}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {"Adviser Email"}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={"Enter adviser's email address"}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {"Access Level"}
        </label>
        <div className="flex space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              checked={accessLevel === "VIEW"}
              onChange={() => setAccessLevel("VIEW")}
              className="text-blue-600"
            />
            <span className="text-sm">{"View Only"}</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              checked={accessLevel === "FULL"}
              onChange={() => setAccessLevel("FULL")}
              className="text-blue-600"
            />
            <span className="text-sm">{"Full Access"}</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {"Select portfolios to share"}
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
