import React, { useState } from "react"
import Dialog from "@components/ui/Dialog"
import { useDialogSubmit } from "@hooks/useDialogSubmit"

export interface CopyFields {
  weight: boolean
  price: boolean
  currency: boolean
  narrative: boolean
}

export const DEFAULT_COPY_FIELDS: CopyFields = {
  weight: true,
  price: true,
  currency: true,
  narrative: false,
}

interface CopyFieldsDialogProps {
  initialFields: CopyFields
  onCopy: (fields: CopyFields) => Promise<void>
  onCancel: () => void
}

const FIELD_LABELS: { key: keyof CopyFields; label: string }[] = [
  { key: "weight", label: "Weight %" },
  { key: "price", label: "Price" },
  { key: "currency", label: "Currency" },
  { key: "narrative", label: "Narrative" },
]

const CopyFieldsDialog: React.FC<CopyFieldsDialogProps> = ({
  initialFields,
  onCopy,
  onCancel,
}) => {
  const [fields, setFields] = useState<CopyFields>(initialFields)
  const { isSubmitting, submitError, handleSubmit } = useDialogSubmit({
    fallbackError: "Could not copy to clipboard. Please try again.",
  })

  const toggle = (key: keyof CopyFields): void => {
    setFields((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleCopyClick = async (): Promise<void> => {
    await handleSubmit(async () => {
      await onCopy(fields)
      onCancel()
    })
  }

  return (
    <Dialog
      title="Copy Target Allocations"
      onClose={onCancel}
      maxWidth="sm"
      footer={
        <>
          <Dialog.CancelButton onClick={onCancel} />
          <Dialog.SubmitButton
            onClick={handleCopyClick}
            label="Copy"
            loadingLabel="Copying..."
            isSubmitting={isSubmitting}
            variant="blue"
          />
        </>
      }
    >
      <Dialog.ErrorAlert message={submitError} />
      <p className="text-sm text-gray-600">
        {"Asset is always included. Choose which other fields to copy:"}
      </p>
      <div className="space-y-2">
        {FIELD_LABELS.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center gap-2 text-sm text-gray-700"
          >
            <input
              type="checkbox"
              checked={fields[key]}
              onChange={() => toggle(key)}
              className="rounded border-gray-300"
            />
            {label}
          </label>
        ))}
      </div>
    </Dialog>
  )
}

export default CopyFieldsDialog
