import React, { useEffect } from "react"
import { useRouter } from "next/router"
import { useMilestones } from "@contexts/MilestonesContext"
import {
  TIER_COLORS,
  TIER_LABELS,
  MilestoneTier,
} from "@utils/milestones/types"

const TOAST_DURATION = 5000

/**
 * Milestone toast notification — bottom-right, auto-dismisses in 5s.
 * Clickable → navigates to /milestones.
 */
export default function MilestoneToast(): React.ReactElement | null {
  const { latestEarned, dismissToast } = useMilestones()
  const router = useRouter()

  useEffect(() => {
    if (!latestEarned) return undefined
    const timer = setTimeout(dismissToast, TOAST_DURATION)
    return () => clearTimeout(timer)
  }, [latestEarned, dismissToast])

  if (!latestEarned || !latestEarned.earnedTier) return null

  const tier = latestEarned.earnedTier as MilestoneTier
  const colors = TIER_COLORS[tier]
  const tierLabel = TIER_LABELS[tier]
  const tierDef = latestEarned.definition.tiers.find((t) => t.tier === tier)

  return (
    <div
      className="fixed bottom-4 right-4 z-50 animate-slide-up cursor-pointer"
      onClick={() => {
        dismissToast()
        router.push("/milestones")
      }}
      role="status"
      aria-live="polite"
    >
      <div
        className={`${colors.bgLight} ${colors.border} border rounded-xl shadow-lg p-4 max-w-sm flex items-center gap-3`}
      >
        <div
          className={`${colors.bg} w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}
        >
          <i
            className={`fas ${tierDef?.icon ?? latestEarned.definition.icon} text-white`}
          ></i>
        </div>
        <div className="min-w-0">
          <p className={`font-semibold ${colors.text} text-sm`}>
            {tierLabel}: {latestEarned.definition.title}
          </p>
          <p className="text-gray-600 text-xs truncate">
            {tierDef?.description ?? ""}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            dismissToast()
          }}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          aria-label="Dismiss"
        >
          <i className="fas fa-times text-xs"></i>
        </button>
      </div>
    </div>
  )
}
