import React, { useState } from "react"
import { useWatchlist } from "@hooks/useWatchlist"
import { formatCurrency } from "@lib/formatters"
import WatchItemEditor from "@components/features/watchlists/WatchItemEditor"
import { describeTargetDistance } from "@components/features/watchlists/TargetDistance"

interface WatchIconProps {
  assetId: string
  /** Decimal places for the target in the tooltip, matching the asset's price. */
  scale?: number
  /** Override icon size (default `text-xs`), to match the icons beside it. */
  iconClassName?: string
}

/**
 * Beside an asset's label: a target when the caller's watchlist sets one for
 * it, an eye when it is watched without a target, nothing when unwatched. The
 * tooltip names the target and how far the price is off it; clicking edits
 * the watchlist item.
 */
export default function WatchIcon({
  assetId,
  scale = 2,
  iconClassName = "text-xs",
}: WatchIconProps): React.ReactElement | null {
  const { items } = useWatchlist()
  const [editing, setEditing] = useState(false)
  const item = items?.find((i) => i.asset.id === assetId)
  if (!item) {
    // A vanished item must not leave the editor armed, or it reopens
    // unasked when the asset is watched again.
    if (editing) setEditing(false)
    return null
  }

  let title = "Watching, no target"
  if (item.targetPrice != null) {
    const target = `Target ${item.currency.code} ${formatCurrency(item.targetPrice, scale)}`
    title =
      item.toTarget == null
        ? target
        : `${target} · ${describeTargetDistance(item.toTarget)}`
  }
  const icon = item.targetPrice == null ? "fa-eye" : "fa-bullseye"

  return (
    <>
      <button
        type="button"
        data-testid="watch-icon"
        title={title}
        aria-label={title}
        className="-m-1.5 p-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 text-gray-500 hover:text-gray-900 transition-colors"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setEditing(true)
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <i aria-hidden="true" className={`fas ${icon} ${iconClassName}`}></i>
      </button>
      {editing && (
        <WatchItemEditor item={item} onClose={() => setEditing(false)} />
      )}
    </>
  )
}
