import React from "react"
import type { RetirementPlan } from "types/independence"

interface PlanInclusionChipsProps {
  plans: RetirementPlan[]
  excludedPlanIds: Set<string>
  onToggle: (planId: string) => void
}

/**
 * Which of the journey's plans take a stretch of the timeline. Only shown
 * when there is a choice to make — a single plan is simply the whole band.
 */
export default function PlanInclusionChips({
  plans,
  excludedPlanIds,
  onToggle,
}: PlanInclusionChipsProps): React.ReactElement | null {
  if (plans.length <= 1) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-500">
        Plans in this timeline
      </span>
      {plans.map((plan) => {
        const included = !excludedPlanIds.has(plan.id)
        return (
          // A button carrying the checkbox role, not a label wrapping an
          // input — the wrapped-input form double-fires when the whole
          // chip is the tap target.
          <button
            key={plan.id}
            type="button"
            role="checkbox"
            aria-checked={included}
            onClick={() => onToggle(plan.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-independence-500 motion-reduce:transition-none ${
              included
                ? "border-independence-200 bg-independence-50 text-independence-700"
                : "border-gray-200 bg-white text-gray-400 line-through hover:text-gray-600"
            }`}
          >
            {plan.name}
          </button>
        )
      })}
    </div>
  )
}
