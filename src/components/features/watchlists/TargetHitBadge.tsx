import React from "react"
import { formatDate } from "@lib/formatters"

interface TargetHitBadgeProps {
  /** ISO date the backend recorded the target as hit. */
  hitOn: string
  className?: string
}

/** The amber "Target hit {date}" pill shown wherever a watchlist item is. */
export default function TargetHitBadge({
  hitOn,
  className = "",
}: TargetHitBadgeProps): React.ReactElement {
  return (
    <span
      data-testid="target-hit"
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 ${className}`}
    >
      <i aria-hidden="true" className="fas fa-bullseye"></i>
      {`Target hit ${formatDate(hitOn)}`}
    </span>
  )
}
