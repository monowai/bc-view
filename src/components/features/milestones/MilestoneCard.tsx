import React from "react"
import {
  MilestoneState,
  MilestoneTier,
  TIER_COLORS,
  TIER_LABELS,
} from "@utils/milestones/types"

interface MilestoneCardProps {
  state: MilestoneState
}

/**
 * Card for the milestones page showing status, tiers, and next hint.
 */
export default function MilestoneCard({
  state,
}: MilestoneCardProps): React.ReactElement {
  const { definition, earnedTier, earnedAt, nextTier } = state
  const isEarned = earnedTier !== null
  const colors = isEarned ? TIER_COLORS[earnedTier as MilestoneTier] : null

  return (
    <div
      className={`rounded-xl border p-4 ${
        isEarned
          ? `${colors!.bgLight} ${colors!.border}`
          : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isEarned ? colors!.bg : "bg-gray-200"
          }`}
        >
          <i
            className={`fas ${definition.icon} ${
              isEarned ? "text-white" : "text-gray-400"
            }`}
          ></i>
        </div>
        <div>
          <h3
            className={`font-semibold text-sm ${
              isEarned ? colors!.text : "text-gray-500"
            }`}
          >
            {definition.title}
          </h3>
          {isEarned && (
            <span className="text-xs text-gray-500">
              {TIER_LABELS[earnedTier as MilestoneTier]}
              {earnedAt && ` — ${earnedAt}`}
            </span>
          )}
        </div>
      </div>

      {/* Tier progress dots */}
      <div className="flex gap-2 mb-2">
        {definition.tiers.map((t) => {
          const earned = earnedTier !== null && t.tier <= earnedTier
          const tierColor = earned ? TIER_COLORS[t.tier as MilestoneTier] : null
          return (
            <div
              key={t.tier}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                earned
                  ? `${tierColor!.bgLight} ${tierColor!.text}`
                  : "bg-gray-100 text-gray-400"
              }`}
              title={t.description}
            >
              <i className={`fas ${t.icon}`}></i>
              <span>{t.label}</span>
            </div>
          )
        })}
      </div>

      {/* Next tier hint */}
      {nextTier && (
        <p className="text-xs text-gray-500 mt-2">
          <i className="fas fa-arrow-right mr-1"></i>
          Next: {nextTier.description}
        </p>
      )}

      {!isEarned && definition.tiers[0] && (
        <p className="text-xs text-gray-400 mt-2">
          {definition.tiers[0].description}
        </p>
      )}
    </div>
  )
}
