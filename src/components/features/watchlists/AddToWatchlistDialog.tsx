import React, { useId, useRef, useState } from "react"
import { mutate } from "swr"
import { AssetOption, WatchlistItem } from "types/beancounter"
import Dialog from "@components/ui/Dialog"
import AssetSearch from "@components/features/assets/AssetSearch"
import { createAsset } from "@lib/assets/createAsset"
import {
  WatchlistApiError,
  addWatchlistItem,
  parseOptionalPrice,
} from "@lib/watchlists/watchlistApi"
import { watchlistKey } from "@utils/api/fetchHelper"

export interface WatchlistAssetRef {
  id: string
  /** What the reader sees in the title, e.g. the display code. */
  label: string
}

interface AddToWatchlistDialogProps {
  /** The asset to add. Absent → the dialog shows an asset picker. */
  asset?: WatchlistAssetRef
  onClose: () => void
  onAdded?: (item: WatchlistItem) => void
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelClass = "block text-sm font-medium text-gray-700 mb-1"

/**
 * Add one asset to the caller's watchlist (one per user). The added price is
 * optional: left blank, the server stamps the latest close. When it has none
 * it answers 400 with a message asking for one — that message is shown and the
 * user can enter a price and try again.
 */
export default function AddToWatchlistDialog({
  asset,
  onClose,
  onAdded,
}: AddToWatchlistDialogProps): React.ReactElement {
  const fieldId = useId()
  const [picked, setPicked] = useState<AssetOption | null>(null)
  const [targetText, setTargetText] = useState("")
  const [addedText, setAddedText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [needsPrice, setNeedsPrice] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const addedPriceRef = useRef<HTMLInputElement>(null)

  const assetLabel = asset?.label || picked?.symbol || "This asset"

  const resolveAssetId = async (): Promise<string> => {
    if (asset) return asset.id
    if (!picked) throw new Error("Choose an asset")
    if (picked.assetId) return picked.assetId
    const created = await createAsset(picked)
    setPicked({ ...picked, assetId: created.id })
    return created.id
  }

  const handleSubmit = async (): Promise<void> => {
    setError(null)
    setNeedsPrice(false)
    const targetPrice = parseOptionalPrice(targetText)
    const addedPrice = parseOptionalPrice(addedText)
    if (targetPrice === null) {
      setError("Target price must be a positive number")
      return
    }
    if (addedPrice === null) {
      setError("Added price must be a positive number")
      return
    }
    setSubmitting(true)
    // Only a 400 from the item add means "no price known"; resolving the
    // asset can fail for its own reasons.
    let addingItem = false
    try {
      const assetId = await resolveAssetId()
      addingItem = true
      const item = await addWatchlistItem({
        assetId,
        ...(addedPrice === undefined ? {} : { addedPrice }),
        ...(targetPrice === undefined ? {} : { targetPrice }),
      })
      onAdded?.(item)
      onClose()
      // Best-effort refresh: the item exists now, so a failed refresh must
      // not read as a failed add (a retry would only meet a 409).
      void mutate(watchlistKey)
    } catch (e) {
      if (addingItem && e instanceof WatchlistApiError && e.status === 409) {
        setError(`${assetLabel} is already on your watchlist`)
      } else {
        setError(e instanceof Error ? e.message : "Failed to add")
        if (addingItem && e instanceof WatchlistApiError && e.status === 400) {
          setNeedsPrice(true)
          addedPriceRef.current?.focus()
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const title = asset ? `Add ${asset.label} to Watchlist` : "Add to Watchlist"

  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} />
          <Dialog.SubmitButton
            onClick={handleSubmit}
            label="Add"
            loadingLabel="Adding..."
            isSubmitting={submitting}
            disabled={!asset && !picked}
            variant="blue"
          />
        </>
      }
    >
      {!asset && (
        <div>
          <label htmlFor={`${fieldId}-asset`} className={labelClass}>
            {"Asset"}
          </label>
          <AssetSearch
            inputId={`${fieldId}-asset`}
            value={picked}
            onSelect={setPicked}
            usePortal
            placeholder={"Type asset symbol or name..."}
          />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${fieldId}-target`} className={labelClass}>
            {"Target price"}
          </label>
          <input
            id={`${fieldId}-target`}
            className={inputClass}
            inputMode="decimal"
            placeholder={"Optional"}
            value={targetText}
            onChange={(e) => setTargetText(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-added`} className={labelClass}>
            {"Added price"}
          </label>
          <input
            id={`${fieldId}-added`}
            ref={addedPriceRef}
            aria-invalid={needsPrice}
            className={`${inputClass} ${needsPrice ? "border-red-400" : ""}`}
            inputMode="decimal"
            placeholder={"Latest close"}
            value={addedText}
            onChange={(e) => setAddedText(e.target.value)}
          />
        </div>
      </div>
      <Dialog.ErrorAlert message={error} />
    </Dialog>
  )
}
