import React, { useState } from "react"
import { AssetOption } from "types/beancounter"
import { useWatchlist } from "@hooks/useWatchlist"
import { WatchlistAssetRef } from "@components/features/watchlists/AddToWatchlistDialog"
import { createAsset } from "@lib/assets/createAsset"
import {
  WatchlistApiError,
  addWatchlistItem,
  removeWatchlistItem,
} from "@utils/api/client/watchlist"

/**
 * The watchlist star on a search result: on or off the watchlist in one tap,
 * without opening the asset. A hit not yet known to BC is created first. The
 * added price is the latest close the server stamps; when it has none (400),
 * [onNeedsPrice] asks the user for one, else the server's reason is shown.
 */
export default function WatchlistStar({
  option,
  onNeedsPrice,
}: {
  option: AssetOption
  /** The asset has no price to stamp: ask for an added price instead. */
  onNeedsPrice?: (asset: WatchlistAssetRef) => void
}): React.ReactElement | null {
  const { items, mutate } = useWatchlist()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  if (!option.market || !option.watchable) return null

  const watched = option.assetId
    ? items?.find((item) => item.asset.id === option.assetId)
    : undefined
  const code = option.displayCode || option.symbol
  const label = watched
    ? `Remove ${code} from watchlist`
    : `Add ${code} to watchlist`

  const toggle = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    // Only the item add's statuses mean "already watched" or "no price"; creating the asset fails for its own reasons.
    let assetId: string | undefined
    try {
      if (watched) {
        await removeWatchlistItem(watched.id)
      } else {
        assetId = option.assetId ?? (await createAsset(option)).id
        await addWatchlistItem({ assetId })
      }
    } catch (err) {
      const status = err instanceof WatchlistApiError ? err.status : undefined
      if (assetId && status === 400 && onNeedsPrice) {
        onNeedsPrice({ id: assetId, label: code })
      } else if (!(assetId && status === 409)) {
        // 409: already watched elsewhere; the refresh below shows it starred.
        setMessage(
          err instanceof Error ? err.message : "Watchlist update failed",
        )
      }
    } finally {
      setBusy(false)
      await mutate()
    }
  }

  return (
    <span className="flex items-center gap-2 flex-shrink-0">
      {message && <span className="text-xs text-red-600">{message}</span>}
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={busy || items === undefined}
        // react-select picks an option on its click; keep the star's clicks to itself.
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.stopPropagation()
          void toggle()
        }}
        className="text-blue-600 hover:text-blue-800 disabled:opacity-50 px-1"
      >
        <i className={watched ? "fas fa-star" : "far fa-star"}></i>
      </button>
    </span>
  )
}
