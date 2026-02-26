import React, { useState } from "react"
import Dialog from "@components/ui/Dialog"
import { useDialogSubmit } from "@hooks/useDialogSubmit"

interface RequestAccessDialogProps {
  onClose: () => void
  onSuccess: () => void
}

export default function RequestAccessDialog({
  onClose,
  onSuccess,
}: RequestAccessDialogProps): React.ReactElement {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const {
    isSubmitting,
    submitError: error,
    submitSuccess,
    handleSubmit,
    setError,
  } = useDialogSubmit({
    onSuccess,
    autoCloseDelay: 1500,
    fallbackError: "Failed to send request",
  })

  const onSubmit = async (): Promise<void> => {
    if (!email.trim()) {
      setError("Email is required")
      return
    }

    await handleSubmit(async () => {
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
        throw new Error(data.error || "Failed to send request")
      }
    })
  }

  return (
    <Dialog
      title={"Request Access"}
      onClose={onClose}
      maxWidth="md"
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
          <Dialog.SubmitButton
            onClick={onSubmit}
            label={"Send Request"}
            loadingLabel={"Sending..."}
            isSubmitting={isSubmitting}
            disabled={!email.trim()}
            variant="blue"
          />
        </>
      }
    >
      <Dialog.ErrorAlert message={error} />
      <Dialog.SuccessAlert
        message={submitSuccess ? "Access request sent successfully" : null}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {"Client Email"}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={"Enter client's email address"}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {"Message (optional)"}
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={"Why are you requesting access?"}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
    </Dialog>
  )
}
