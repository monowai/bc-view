import React from "react"
import Dialog from "./Dialog"

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  /** Shown on the confirm button while isSubmitting is true. */
  loadingLabel?: string
  cancelLabel?: string
  variant?: "red" | "amber" | "blue"
  /** Keeps the dialog's confirm button disabled while an async confirm runs. */
  isSubmitting?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  loadingLabel,
  cancelLabel = "Cancel",
  variant = "red",
  isSubmitting = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactElement {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      maxWidth="sm"
      footer={
        <>
          <Dialog.CancelButton onClick={onCancel} label={cancelLabel} />
          <Dialog.SubmitButton
            onClick={onConfirm}
            label={confirmLabel}
            loadingLabel={loadingLabel}
            isSubmitting={isSubmitting}
            variant={variant}
          />
        </>
      }
    >
      <p className="text-gray-600">{message}</p>
    </Dialog>
  )
}
