import React, { useState } from "react"
import Dialog from "@components/ui/Dialog"

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
  onConfirm: (fields: CopyFields) => void
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
  onConfirm,
  onCancel,
}) => {
  const [fields, setFields] = useState<CopyFields>(initialFields)

  const toggle = (key: keyof CopyFields): void => {
    setFields((prev) => ({ ...prev, [key]: !prev[key] }))
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
            onClick={() => onConfirm(fields)}
            label="Copy"
            variant="blue"
          />
        </>
      }
    >
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
