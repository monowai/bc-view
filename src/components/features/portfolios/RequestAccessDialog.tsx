import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import Dialog from "@components/ui/Dialog"

interface RequestAccessDialogProps {
  onClose: () => void
  onSuccess: () => void
}

export default function RequestAccessDialog({
  onClose,
  onSuccess,
}: RequestAccessDialogProps): React.ReactElement {
  const { t } = useTranslation("common")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (): Promise<void> => {
    setError(null)
    setSuccess(null)

    if (!email.trim()) {
      setError(t("shares.request.error"))
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/shares/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: email.trim(),
          message: message.trim() || undefined,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error || t("shares.request.error"))
        return
      }
      setSuccess(t("shares.request.success"))
      setTimeout(() => {
        onSuccess()
      }, 1500)
    } catch {
      setError(t("shares.request.error"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      title={t("shares.request.title")}
      onClose={onClose}
      maxWidth="md"
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={t("cancel")} />
          <Dialog.SubmitButton
            onClick={handleSubmit}
            label={t("shares.request.submit")}
            loadingLabel={t("shares.request.sending")}
            isSubmitting={isSubmitting}
            disabled={!email.trim()}
            variant="blue"
          />
        </>
      }
    >
      <Dialog.ErrorAlert message={error} />
      <Dialog.SuccessAlert message={success} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("shares.request.email")}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("shares.request.email.placeholder")}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("shares.request.message")}
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("shares.request.message.placeholder")}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
    </Dialog>
  )
}
