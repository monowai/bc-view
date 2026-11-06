import React from "react"
import { useWatchlist } from "@hooks/useWatchlist"
import { formatCurrency } from "@lib/formatters"

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
 * price. Hidden unless a target is set. The target is never converted: when
 * the price beside it is in another currency, the target names its own.
 */
export default function WatchTargetPrice({
  assetId,
  currencyCode,
  scale = 2,
  className = "inline-flex",
}: WatchTargetPriceProps): React.ReactElement | null {
  const { items } = useWatchlist()
  const item = items?.find((i) => i.asset.id === assetId)
  if (item?.targetPrice == null) return null

  const value = formatCurrency(item.targetPrice, scale)
  const money =
    item.currency.code === currencyCode
      ? `${item.currency.symbol}${value}`
      : `${item.currency.code} ${value}`
  return (
    <span
      data-testid="watch-target"
      title={`Watchlist target ${money}`}
      className={`items-center gap-1 whitespace-nowrap text-xs text-gray-500 ${className}`}
    >
      <i aria-hidden="true" className="fas fa-bullseye text-gray-400"></i>
      <span>
        {"Target "}
        <span className="font-mono tabular-nums">{money}</span>
      </span>
    </span>
  )
}
