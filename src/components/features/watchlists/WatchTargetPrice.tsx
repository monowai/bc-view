import React, { useState } from "react"
import { useWatchlist } from "@hooks/useWatchlist"
import { formatCurrency } from "@lib/formatters"
import WatchItemEditor from "@components/features/watchlists/WatchItemEditor"

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
 * price; "Watching" when the asset is watched without a target. Hidden when
 * the asset is not watched. Clicking it edits the watchlist item. The target
 * is never converted: when the price beside it is in another currency, the
 * target names its own.
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
  if (!item) return null

  let label: React.ReactNode
  let title: string
  let icon: string
  if (item.targetPrice == null) {
    label = "Watching"
    title = "On your watchlist, no target. Click to set one"
    icon = "fa-eye"
  } else {
    const value = formatCurrency(item.targetPrice, scale)
    const money =
      item.currency.code === currencyCode
        ? `${item.currency.symbol}${value}`
        : `${item.currency.code} ${value}`
    label = (
      <>
        {"Target "}
        <span className="font-mono tabular-nums">{money}</span>
      </>
    )
    title = `Watchlist target ${money}`
    icon = "fa-bullseye"
  }

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
        <i aria-hidden="true" className={`fas ${icon} text-gray-400`}></i>
        <span>{label}</span>
      </button>
      {editing && (
        <WatchItemEditor item={item} onClose={() => setEditing(false)} />
      )}
    </span>
  )
}
