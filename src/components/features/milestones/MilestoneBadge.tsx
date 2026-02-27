import React from "react"
import {
  MilestoneDefinition,
  MilestoneTier,
  TIER_COLORS,
  TIER_ICONS,
  TIER_LABELS,
} from "@utils/milestones/types"

interface MilestoneBadgeProps {
  definition: MilestoneDefinition
  tier: MilestoneTier | null
  size?: "sm" | "md"
}

/**
 * Compact badge showing a milestone icon with tier indicator.
 */
export default function MilestoneBadge({
  definition,
  tier,
  size = "md",
}: MilestoneBadgeProps): React.ReactElement {
  const isEarned = tier !== null
  const colors = isEarned ? TIER_COLORS[tier] : null
  const sizeClasses = size === "sm" ? "w-8 h-8" : "w-10 h-10"
  const iconSize = size === "sm" ? "text-sm" : "text-base"

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${sizeClasses} rounded-full flex items-center justify-center ${
          isEarned ? colors!.bg : "bg-gray-200"
        }`}
        title={
          isEarned
            ? `${definition.title} — ${TIER_LABELS[tier]}`
            : `${definition.title} — Not yet earned`
        }
      >
        <i
          className={`fas ${definition.icon} ${iconSize} ${
            isEarned ? "text-white" : "text-gray-400"
          }`}
        ></i>
      </div>
      {isEarned && (
        <i
          className={`fas ${TIER_ICONS[tier]} text-xs ${colors!.text}`}
          title={TIER_LABELS[tier]}
        ></i>
      )}
    </div>
  )
}
