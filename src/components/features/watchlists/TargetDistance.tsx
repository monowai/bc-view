import React from "react"
import { formatPercent } from "@lib/formatters"

interface TargetDistanceProps {
  /** (target - price) / price, as a fraction (0.25 = 25%). */
  toTarget: number
  className?: string
}

/**
 * How far the price must move to reach a watchlist target, and which way:
 * "▼ 16.72%". A distance is neither a gain nor a loss, so it is never
 * red or green; the arrow carries the direction.
 */
export default function TargetDistance({
  toTarget,
  className = "",
}: TargetDistanceProps): React.ReactElement {
  // Rounded as shown, so a target the price rounds to reads "at target".
  const shown = formatPercent(Math.abs(toTarget))
  const atTarget = Number.parseFloat(shown) === 0
  const falls = toTarget < 0
  return (
    <span
      data-testid="target-distance"
      className={`text-gray-500 tabular-nums ${className}`}
    >
      {atTarget ? (
        "at target"
      ) : (
        <>
          <span data-testid="target-arrow" aria-hidden="true">
            {falls ? "▼" : "▲"}
          </span>
          <span className="sr-only">
            {falls ? "price must fall" : "price must rise"}
          </span>{" "}
          {shown}
        </>
      )}
    </span>
  )
}
