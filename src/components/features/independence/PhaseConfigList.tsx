import React from "react"
import type { RetirementPlan, CompositePhase } from "types/independence"

interface PhaseConfigListProps {
  plans: RetirementPlan[]
  phases: CompositePhase[]
  onPhaseChange: (phases: CompositePhase[]) => void
  onExclude: (planId: string) => void
  excludedPlanIds: Set<string>
}

function getPlanName(plans: RetirementPlan[], planId: string): string {
  return plans.find((p) => p.id === planId)?.name ?? "Unknown Plan"
}

export default function PhaseConfigList({
  plans,
  phases,
  onPhaseChange,
  onExclude,
  excludedPlanIds,
}: PhaseConfigListProps): React.ReactElement {
  const handleFromAgeChange = (index: number, value: number): void => {
    const updated = [...phases]
    updated[index] = { ...updated[index], fromAge: value }

    // Auto-adjust previous phase's toAge to prevent gaps
    if (index > 0) {
      updated[index - 1] = { ...updated[index - 1], toAge: value }
    }
    onPhaseChange(updated)
  }

  const handleToAgeChange = (index: number, value: number): void => {
    const updated = [...phases]
    updated[index] = { ...updated[index], toAge: value }

    // Auto-adjust next phase's fromAge to prevent gaps
    if (index < phases.length - 1) {
      updated[index + 1] = { ...updated[index + 1], fromAge: value }
    }
    onPhaseChange(updated)
  }

  const handleMoveUp = (index: number): void => {
    if (index === 0) return
    const updated = [...phases]
    // Swap plan IDs but keep age ranges
    const prevPlanId = updated[index - 1].planId
    updated[index - 1] = {
      ...updated[index - 1],
      planId: updated[index].planId,
    }
    updated[index] = { ...updated[index], planId: prevPlanId }
    onPhaseChange(updated)
  }

  const handleMoveDown = (index: number): void => {
    if (index === phases.length - 1) return
    const updated = [...phases]
    const nextPlanId = updated[index + 1].planId
    updated[index + 1] = {
      ...updated[index + 1],
      planId: updated[index].planId,
    }
    updated[index] = { ...updated[index], planId: nextPlanId }
    onPhaseChange(updated)
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 mb-2">
        Phase Configuration
      </h3>

      {/* Excluded plans toggle */}
      {plans.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {plans.map((plan) => (
            <label
              key={plan.id}
              className="inline-flex items-center text-xs cursor-pointer"
            >
              <input
                type="checkbox"
                checked={!excludedPlanIds.has(plan.id)}
                onChange={() => onExclude(plan.id)}
                className="rounded border-gray-300 text-independence-600 focus:ring-independence-500 mr-1"
              />
              <span
                className={
                  excludedPlanIds.has(plan.id)
                    ? "text-gray-400 line-through"
                    : "text-gray-700"
                }
              >
                {plan.name}
              </span>
            </label>
          ))}
        </div>
      )}

      {/* Phase rows */}
      {phases.length === 0 ? (
        <p className="text-sm text-gray-500">
          Select at least one plan to configure phases.
        </p>
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {phases.map((phase, index) => {
            const isLast = index === phases.length - 1
            const toAge = phase.toAge ?? "end"
            const duration =
              typeof toAge === "number" ? toAge - phase.fromAge : "..."
            return (
              <div
                key={phase.planId}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <span className="text-gray-400 w-16 shrink-0">
                  Phase {index + 1}:
                </span>
                <span className="font-medium text-gray-800 truncate min-w-0 flex-1">
                  {getPlanName(plans, phase.planId)}
                </span>
                <input
                  type="number"
                  value={phase.fromAge}
                  onChange={(e) =>
                    handleFromAgeChange(index, Number(e.target.value))
                  }
                  className="w-14 px-1 py-0.5 border border-gray-300 rounded text-center text-sm focus:ring-1 focus:ring-independence-500 focus:border-independence-500"
                  min={18}
                  max={120}
                  aria-label={`Phase ${index + 1} from age`}
                />
                <span className="text-gray-400">→</span>
                {isLast ? (
                  <span className="w-14 text-center text-gray-500">end</span>
                ) : (
                  <input
                    type="number"
                    value={phase.toAge ?? ""}
                    onChange={(e) =>
                      handleToAgeChange(index, Number(e.target.value))
                    }
                    className="w-14 px-1 py-0.5 border border-gray-300 rounded text-center text-sm focus:ring-1 focus:ring-independence-500 focus:border-independence-500"
                    min={18}
                    max={120}
                    aria-label={`Phase ${index + 1} to age`}
                  />
                )}
                <span className="text-xs text-gray-400 w-16 text-right">
                  ({typeof duration === "number" ? `${duration} yr` : duration})
                </span>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    title="Move up"
                    aria-label={`Move phase ${index + 1} up`}
                  >
                    <i className="fas fa-chevron-up text-xs"></i>
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={isLast}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    title="Move down"
                    aria-label={`Move phase ${index + 1} down`}
                  >
                    <i className="fas fa-chevron-down text-xs"></i>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
