import React from "react"
import Dialog from "./Dialog"

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "red" | "amber" | "blue"
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "red",
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
            variant={variant}
          />
        </>
      }
    >
      <p className="text-gray-600">{message}</p>
    </Dialog>
  )
}
