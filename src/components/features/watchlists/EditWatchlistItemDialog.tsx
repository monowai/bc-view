import React, { useId, useState } from "react"
import { WatchlistItem, WatchlistItemUpdate } from "types/beancounter"
import Dialog from "@components/ui/Dialog"
import { getPositionDisplayName } from "@lib/assets/assetUtils"
import { parseOptionalPrice } from "@utils/api/client/watchlist"

interface EditWatchlistItemDialogProps {
  item: WatchlistItem
  /** Resolve on success; throw to show the error. */
  onSubmit: (update: WatchlistItemUpdate) => Promise<void>
  /** Given → the dialog offers to remove the item from the watchlist. */
  onRemove?: () => void
  onClose: () => void
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelClass = "block text-sm font-medium text-gray-700 mb-1"

/**
 * Edit a watchlist item's target and added price. Only changed fields are
 * sent — the backend treats an absent field as unchanged. Saving an emptied
 * target clears it (`clearTarget: true`), never combined with a new target.
 */
export default function EditWatchlistItemDialog({
  item,
  onSubmit,
  onRemove,
  onClose,
}: EditWatchlistItemDialogProps): React.ReactElement {
  const fieldId = useId()
  const [targetText, setTargetText] = useState(
    item.targetPrice == null ? "" : String(item.targetPrice),
  )
  const [addedText, setAddedText] = useState(String(item.addedPrice))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const run = async (update: WatchlistItemUpdate): Promise<void> => {
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(update)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update")
    } finally {
      setSubmitting(false)
    }
  }

  // An emptied target clears it; clearTarget and targetPrice never pair.
  const handleSave = async (): Promise<void> => {
    const target = parseOptionalPrice(targetText)
    const added = parseOptionalPrice(addedText)
    if (target === null || added === null) {
      setError("Prices must be positive numbers")
      return
    }
    if (added === undefined) {
      setError("Added price is required")
      return
    }
    const update: WatchlistItemUpdate = {}
    if (target === undefined) {
      if (item.targetPrice != null) update.clearTarget = true
    } else if (target !== item.targetPrice) {
      update.targetPrice = target
    }
    if (added !== item.addedPrice) update.addedPrice = added
    if (Object.keys(update).length === 0) {
      onClose()
      return
    }
    await run(update)
  }

  return (
    <Dialog
      title={`Edit ${getPositionDisplayName(item.asset)}`}
      onClose={onClose}
      footer={
        <>
          {onRemove && (
            <button
              type="button"
              className="mr-auto rounded px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
              onClick={onRemove}
              disabled={submitting}
            >
              {"Remove from watchlist"}
            </button>
          )}
          <Dialog.CancelButton onClick={onClose} />
          <Dialog.SubmitButton
            onClick={handleSave}
            label="Save"
            loadingLabel="Saving..."
            isSubmitting={submitting}
            variant="blue"
          />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <label
              htmlFor={`${fieldId}-target`}
              className="text-sm font-medium text-gray-700"
            >
              {`Target price (${item.currency.code})`}
            </label>
            {targetText !== "" && (
              <button
                type="button"
                aria-label="Clear target"
                className="rounded text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                onClick={() => setTargetText("")}
                disabled={submitting}
              >
                {"Clear"}
              </button>
            )}
          </div>
          <input
            id={`${fieldId}-target`}
            className={inputClass}
            inputMode="decimal"
            placeholder={"None"}
            value={targetText}
            onChange={(e) => setTargetText(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-added`} className={labelClass}>
            {`Added price (${item.currency.code})`}
          </label>
          <input
            id={`${fieldId}-added`}
            className={inputClass}
            inputMode="decimal"
            value={addedText}
            onChange={(e) => setAddedText(e.target.value)}
          />
        </div>
      </div>
      <Dialog.ErrorAlert message={error} />
    </Dialog>
  )
}
