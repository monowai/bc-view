import React, { useId, useState } from "react"
import { WatchlistItem, WatchlistItemUpdate } from "types/beancounter"
import Dialog from "@components/ui/Dialog"
import { getPositionDisplayName } from "@lib/assets/assetUtils"
import { parseOptionalPrice } from "@utils/api/client/watchlist"

interface EditWatchlistItemDialogProps {
  item: WatchlistItem
  /** Resolve on success; throw to show the error. */
  onSubmit: (update: WatchlistItemUpdate) => Promise<void>
  onClose: () => void
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelClass = "block text-sm font-medium text-gray-700 mb-1"

/**
 * Edit a watchlist item's target and added price. Only changed fields are
 * sent — the backend treats an absent field as unchanged. Clearing the target
 * is its own action (`clearTarget: true`), never combined with a new target.
 */
export default function EditWatchlistItemDialog({
  item,
  onSubmit,
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

  // `clearing` routes "Clear target" through the same change detection, so an
  // edited added price goes with it. clearTarget and targetPrice never pair.
  const handleSave = async (clearing = false): Promise<void> => {
    const target = clearing ? undefined : parseOptionalPrice(targetText)
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
          {item.targetPrice != null && (
            <button
              type="button"
              className="mr-auto px-4 py-2 rounded text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => handleSave(true)}
              disabled={submitting}
            >
              {"Clear target"}
            </button>
          )}
          <Dialog.CancelButton onClick={onClose} />
          <Dialog.SubmitButton
            onClick={() => handleSave()}
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
          <label htmlFor={`${fieldId}-target`} className={labelClass}>
            {`Target price (${item.currency.code})`}
          </label>
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
