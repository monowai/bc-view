import React, { useState } from "react"
import Link from "next/link"
import type { RetirementPlan, CompositePhase } from "types/independence"
import MathInput from "@components/ui/MathInput"
import {
  phaseTone,
  resolvePhases,
} from "@components/features/independence/composite/PhaseTimeline"

interface PhaseConfigListProps {
  plans: RetirementPlan[]
  phases: CompositePhase[]
  onPhaseChange: (phases: CompositePhase[]) => void
  onExclude: (planId: string) => void
  excludedPlanIds: Set<string>
  /** Resolved horizon for the open-ended last phase (from the projection). */
  horizonAge?: number
  /** Phase highlighted on the timeline band, kept in sync both ways. */
  activeIndex?: number | null
  onActiveChange?: (index: number | null) => void
}

const AGE_INPUT_CLASS =
  "w-16 rounded-md border border-gray-300 px-2 py-1 text-center font-mono text-sm tabular-nums text-gray-900 focus:border-independence-500 focus:outline-none focus:ring-1 focus:ring-independence-500"

const ORDER_BUTTON_CLASS =
  "rounded p-1.5 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-1 focus:ring-independence-500 disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none"

function getPlanName(plans: RetirementPlan[], planId: string): string {
  return plans.find((p) => p.id === planId)?.name ?? "Unknown Plan"
}

function getPlanNarrative(
  plans: RetirementPlan[],
  planId: string,
): string | undefined {
  return plans.find((p) => p.id === planId)?.narrative?.trim() || undefined
}

/**
 * Read-only context for one phase, sourced from that phase's own plan. The
 * composite carries no narrative of its own — the story of a composite plan
 * is the phases it runs through, so each phase shows its plan's narrative and
 * links to where that narrative is edited.
 */
function PhaseNarrative({
  planId,
  narrative,
}: {
  planId: string
  narrative: string | undefined
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false)

  if (!narrative) {
    return (
      <p className="mt-1 text-sm text-gray-500">
        No context yet —{" "}
        <Link
          href={`/independence/wizard/${planId}`}
          className="font-medium text-independence-700 underline-offset-2 hover:underline"
        >
          describe this phase
        </Link>
        .
      </p>
    )
  }

  return (
    <div className="mt-1">
      <p
        className={`max-w-[70ch] text-sm text-gray-600 ${
          expanded ? "" : "line-clamp-2"
        }`}
      >
        {narrative}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="font-medium text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline focus:outline-none focus:ring-1 focus:ring-independence-500"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
        <Link
          href={`/independence/wizard/${planId}`}
          className="font-medium text-independence-700 underline-offset-2 hover:underline"
        >
          Edit phase
        </Link>
      </div>
    </div>
  )
}

/**
 * The editable half of the Phases tab: one row per phase carrying its age
 * window, length, order controls, and the plan narrative that says what the
 * phase is for. Pairs with the timeline band above it — the band shows the
 * shape, these rows change it.
 */
export default function PhaseConfigList({
  plans,
  phases,
  onPhaseChange,
  onExclude,
  excludedPlanIds,
  horizonAge,
  activeIndex = null,
  onActiveChange,
}: PhaseConfigListProps): React.ReactElement {
  const resolved = resolvePhases(phases, plans, horizonAge)

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
    <div>
      {plans.length > 1 && (
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
                onClick={() => onExclude(plan.id)}
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
      )}

      {phases.length === 0 ? (
        <div className="py-12 text-center">
          <i
            aria-hidden="true"
            className="fas fa-clipboard-list text-4xl text-gray-300"
          ></i>
          <p className="mt-3 text-lg text-gray-500">No phases yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Include at least one plan above to lay out the years it covers.
          </p>
        </div>
      ) : (
        <ol className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
          {phases.map((phase, index) => {
            const isLast = index === phases.length - 1
            const name = getPlanName(plans, phase.planId)
            const isActive = activeIndex === index
            return (
              <li
                key={phase.planId}
                onMouseEnter={() => onActiveChange?.(index)}
                onMouseLeave={() => onActiveChange?.(null)}
                className={`grid gap-x-6 gap-y-2 px-1 py-3 transition-colors duration-150 motion-reduce:transition-none sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start ${
                  isActive ? "bg-independence-50" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${phaseTone(
                        index,
                      )}`}
                    />
                    <span className="min-w-0 truncate text-sm font-medium text-gray-900">
                      {name}
                    </span>
                  </div>
                  <div className="pl-[1.375rem]">
                    <PhaseNarrative
                      planId={phase.planId}
                      narrative={getPlanNarrative(plans, phase.planId)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-[1.375rem] sm:pl-0">
                  <MathInput
                    value={phase.fromAge}
                    onChange={(v) => handleFromAgeChange(index, Math.round(v))}
                    className={AGE_INPUT_CLASS}
                    min={18}
                    max={120}
                    aria-label={`${name} from age`}
                  />
                  <span aria-hidden="true" className="text-gray-400">
                    →
                  </span>
                  {isLast ? (
                    <span className="w-16 text-center font-mono text-sm text-gray-500">
                      end
                    </span>
                  ) : (
                    <MathInput
                      value={phase.toAge ?? 0}
                      onChange={(v) => handleToAgeChange(index, Math.round(v))}
                      className={AGE_INPUT_CLASS}
                      min={18}
                      max={120}
                      aria-label={`${name} to age`}
                    />
                  )}
                  <span className="w-14 text-right font-mono text-sm tabular-nums text-gray-500">
                    {resolved[index].years} yr
                  </span>
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className={ORDER_BUTTON_CLASS}
                      title="Move up"
                      aria-label={`Move phase ${index + 1} up`}
                    >
                      <i className="fas fa-chevron-up text-xs"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={isLast}
                      className={ORDER_BUTTON_CLASS}
                      title="Move down"
                      aria-label={`Move phase ${index + 1} down`}
                    >
                      <i className="fas fa-chevron-down text-xs"></i>
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
