import React, { useState } from "react"
import { AssetOption } from "types/beancounter"
import { useWatchlist } from "@hooks/useWatchlist"
import { createAsset } from "@lib/assets/createAsset"
import { isWatchable, stripOwnerPrefix } from "@lib/assets/assetUtils"
import {
  WatchlistApiError,
  addWatchlistItem,
  removeWatchlistItem,
} from "@lib/watchlists/watchlistApi"

/**
 * The watchlist star on a search result: on or off the watchlist in one tap,
 * without opening the asset. A hit not yet known to BC is created first. The
 * added price is the latest close the server stamps; when it has none, the
 * server's reason is shown beside the star.
 */
export default function WatchlistStar({
  option,
}: {
  option: AssetOption
}): React.ReactElement | null {
  const { items, mutate } = useWatchlist()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  if (!option.market || !isWatchable({ market: option.market })) return null

  const watched = option.assetId
    ? items?.find((item) => item.asset.id === option.assetId)
    : undefined
  const code = stripOwnerPrefix(option.symbol)
  const label = watched
    ? `Remove ${code} from watchlist`
    : `Add ${code} to watchlist`

  const toggle = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      if (watched) {
        await removeWatchlistItem(watched.id)
      } else {
        const assetId = option.assetId ?? (await createAsset(option)).id
        await addWatchlistItem({ assetId })
      }
    } catch (err) {
      // 409: already watched elsewhere; the refresh below shows it starred.
      if (!(err instanceof WatchlistApiError && err.status === 409)) {
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
