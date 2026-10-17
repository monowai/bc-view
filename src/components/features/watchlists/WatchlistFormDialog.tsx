import React, { useId, useState } from "react"
import { WatchlistRequest } from "types/beancounter"
import Dialog from "@components/ui/Dialog"

interface WatchlistFormDialogProps {
  title: string
  submitLabel: string
  initial?: WatchlistRequest
  /** Resolve on success; throw to show the error (e.g. a 409 duplicate code). */
  onSubmit: (request: WatchlistRequest) => Promise<void>
  onClose: () => void
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelClass = "block text-sm font-medium text-gray-700 mb-1"

/** Create or rename a watchlist. The server trims and upper-cases the code. */
export default function WatchlistFormDialog({
  title,
  submitLabel,
  initial,
  onSubmit,
  onClose,
}: WatchlistFormDialogProps): React.ReactElement {
  const fieldId = useId()
  const [code, setCode] = useState(initial?.code || "")
  const [name, setName] = useState(initial?.name || "")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (): Promise<void> => {
    if (!code.trim()) {
      setError("Enter a code")
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({ code: code.trim(), name: name.trim() || code.trim() })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save watchlist")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} />
          <Dialog.SubmitButton
            onClick={handleSubmit}
            label={submitLabel}
            loadingLabel="Saving..."
            isSubmitting={submitting}
            variant="blue"
          />
        </>
      }
    >
      <div>
        <label htmlFor={`${fieldId}-code`} className={labelClass}>
          {"Code"}
        </label>
        <input
          id={`${fieldId}-code`}
          className={`${inputClass} uppercase`}
          value={code}
          maxLength={20}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor={`${fieldId}-name`} className={labelClass}>
          {"Name"}
        </label>
        <input
          id={`${fieldId}-name`}
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <Dialog.ErrorAlert message={error} />
    </Dialog>
  )
}
