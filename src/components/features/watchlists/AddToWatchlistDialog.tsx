import React, { useId, useRef, useState } from "react"
import { mutate } from "swr"
import { AssetOption, WatchlistItem } from "types/beancounter"
import Dialog from "@components/ui/Dialog"
import AssetSearch from "@components/features/assets/AssetSearch"
import { useWatchlists } from "@hooks/useWatchlists"
import { createAsset } from "@lib/assets/createAsset"
import {
  WatchlistApiError,
  addWatchlistItem,
  createWatchlist,
  parseOptionalPrice,
} from "@lib/watchlists/watchlistApi"
import { watchlistKey, watchlistsKey } from "@utils/api/fetchHelper"

const NEW_WATCHLIST = "__new__"

export interface WatchlistAssetRef {
  id: string
  /** What the reader sees in the title, e.g. the display code. */
  label: string
}

interface AddToWatchlistDialogProps {
  /** The asset to add. Absent → the dialog shows an asset picker. */
  asset?: WatchlistAssetRef
  /** Add straight to this watchlist; hides the watchlist chooser. */
  watchlistId?: string
  onClose: () => void
  onAdded?: (watchlistId: string, item: WatchlistItem) => void
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelClass = "block text-sm font-medium text-gray-700 mb-1"

/**
 * Add one asset to a watchlist. The added price is optional: left blank, the
 * server stamps the latest close. When it has none it answers 400 with a
 * message asking for one — that message is shown and the user can enter a
 * price and try again.
 */
export default function AddToWatchlistDialog({
  asset,
  watchlistId,
  onClose,
  onAdded,
}: AddToWatchlistDialogProps): React.ReactElement {
  const fieldId = useId()
  const { watchlists, isLoading } = useWatchlists()
  const [chosen, setChosen] = useState<string>("")
  const [newCode, setNewCode] = useState("")
  const [newName, setNewName] = useState("")
  const [picked, setPicked] = useState<AssetOption | null>(null)
  const [targetText, setTargetText] = useState("")
  const [addedText, setAddedText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [needsPrice, setNeedsPrice] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // A watchlist created by an earlier attempt that then failed on the item —
  // a retry adds to it rather than creating a second one.
  const createdIdRef = useRef<string | null>(null)
  const addedPriceRef = useRef<HTMLInputElement>(null)

  // Default: the first existing watchlist, or a new one when there are none.
  const selection =
    chosen || (isLoading ? "" : watchlists[0]?.id || NEW_WATCHLIST)
  const creatingNew = !watchlistId && selection === NEW_WATCHLIST

  const resolveWatchlistId = async (): Promise<string> => {
    if (watchlistId) return watchlistId
    if (!creatingNew) return selection
    if (createdIdRef.current) return createdIdRef.current
    const created = await createWatchlist({
      code: newCode.trim(),
      name: newName.trim() || newCode.trim(),
    })
    createdIdRef.current = created.id
    return created.id
  }

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
    if (creatingNew && !newCode.trim()) {
      setError("Enter a code for the new watchlist")
      return
    }
    setSubmitting(true)
    try {
      const assetId = await resolveAssetId()
      const id = await resolveWatchlistId()
      const item = await addWatchlistItem(id, {
        assetId,
        ...(addedPrice === undefined ? {} : { addedPrice }),
        ...(targetPrice === undefined ? {} : { targetPrice }),
      })
      await Promise.all([mutate(watchlistsKey), mutate(watchlistKey(id))])
      onAdded?.(id, item)
      onClose()
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to add"
      setError(message)
      if (e instanceof WatchlistApiError && e.status === 400) {
        setNeedsPrice(true)
        addedPriceRef.current?.focus()
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
            disabled={(!asset && !picked) || (!watchlistId && !selection)}
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
      {!watchlistId && (
        <div>
          <label htmlFor={`${fieldId}-watchlist`} className={labelClass}>
            {"Watchlist"}
          </label>
          <select
            id={`${fieldId}-watchlist`}
            className={inputClass}
            value={selection}
            onChange={(e) => setChosen(e.target.value)}
          >
            {isLoading && <option value="">{"Loading..."}</option>}
            {watchlists.map((w) => (
              <option key={w.id} value={w.id}>
                {`${w.code} — ${w.name}`}
              </option>
            ))}
            <option value={NEW_WATCHLIST}>{"+ New watchlist"}</option>
          </select>
        </div>
      )}
      {creatingNew && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${fieldId}-code`} className={labelClass}>
              {"Code"}
            </label>
            <input
              id={`${fieldId}-code`}
              className={`${inputClass} uppercase`}
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              maxLength={20}
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-name`} className={labelClass}>
              {"Name"}
            </label>
            <input
              id={`${fieldId}-name`}
              className={inputClass}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
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
