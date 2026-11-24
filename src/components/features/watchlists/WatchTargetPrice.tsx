import React, { useState } from "react"
import { useWatchlist } from "@hooks/useWatchlist"
import { formatCurrency } from "@lib/formatters"
import WatchItemEditor from "@components/features/watchlists/WatchItemEditor"
import { describeTargetDistance } from "@components/features/watchlists/TargetDistance"

interface WatchTargetPriceProps {
  assetId: string
  /** Currency of the price this sits beside. */
  currencyCode: string
  /** Decimal places, matching the price beside it. */
  scale?: number
  /** Display and placement classes; defaults to inline. */
  className?: string
}

/**
 * The caller's watchlist target for an asset, set small beneath or beside its
 * price, with the distance to it on hover. Hidden unless a target is set.
 * Clicking it edits the watchlist item. The target is never converted: when
 * the price beside it is in another currency, the target names its own.
 */
export default function WatchTargetPrice({
  assetId,
  currencyCode,
  scale = 2,
  className = "inline-flex",
}: WatchTargetPriceProps): React.ReactElement | null {
  const { items } = useWatchlist()
  const [editing, setEditing] = useState(false)
  const item = items?.find((i) => i.asset.id === assetId)
  if (item?.targetPrice == null) {
    // A vanished target must not leave the editor armed, or it reopens
    // unasked when a target is set again.
    if (editing) setEditing(false)
    return null
  }

  const value = formatCurrency(item.targetPrice, scale)
  const money =
    item.currency.code === currencyCode
      ? `${item.currency.symbol}${value}`
      : `${item.currency.code} ${value}`
  const title =
    item.toTarget == null
      ? `Watchlist target ${money}`
      : `Watchlist target ${money} · ${describeTargetDistance(item.toTarget)}`

  return (
    <span className={className}>
      <button
        type="button"
        data-testid="watch-target"
        title={title}
        className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-gray-500 hover:text-wealth-700 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation()
          setEditing(true)
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <i aria-hidden="true" className="fas fa-bullseye text-gray-400"></i>
        <span>
          {"Target "}
          <span className="font-mono tabular-nums">{money}</span>
        </span>
      </button>
      {editing && (
        <WatchItemEditor item={item} onClose={() => setEditing(false)} />
      )}
    </span>
  )
}
