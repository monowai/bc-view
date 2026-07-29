import React from "react"
import type { CompositePhase, RetirementPlan } from "types/independence"

/**
 * Tonal ramp for phase segments — steps of the Independence capability hue,
 * so a phase reads as one series rather than four unrelated colours. Cycles
 * for users with more phases than steps.
 */
const PHASE_TONES = [
  "bg-independence-700",
  "bg-independence-500",
  "bg-independence-200",
  "bg-independence-600",
  "bg-independence-100",
]

/** Tone class for a phase at `index`. Shared with the phase row markers so a
 *  row and its segment are visibly the same phase. */
export function phaseTone(index: number): string {
  return PHASE_TONES[index % PHASE_TONES.length]
}

export interface ResolvedPhase {
  planId: string
  planName: string
  fromAge: number
  /** Resolved end age — the open-ended last phase borrows the projection's. */
  toAge: number
  years: number
}

function planName(plans: RetirementPlan[], planId: string): string {
  return plans.find((p) => p.id === planId)?.name?.trim() || "Unnamed plan"
}

/**
 * Resolve display ages for a phase list. The last phase carries no `toAge`
 * ("end"), so it borrows the horizon the projection resolved; without a
 * projection yet it falls back to a nominal span so the band still renders
 * proportionally on first paint.
 */
export function resolvePhases(
  phases: CompositePhase[],
  plans: RetirementPlan[],
  horizonAge: number | undefined,
): ResolvedPhase[] {
  const FALLBACK_LAST_PHASE_YEARS = 10
  return phases.map((phase, index) => {
    const isLast = index === phases.length - 1
    const explicit = phase.toAge ?? (isLast ? horizonAge : undefined)
    const toAge = explicit ?? phase.fromAge + FALLBACK_LAST_PHASE_YEARS
    return {
      planId: phase.planId,
      planName: planName(plans, phase.planId),
      fromAge: phase.fromAge,
      toAge,
      years: Math.max(toAge - phase.fromAge, 0),
    }
  })
}

interface PhaseTimelineProps {
  resolved: ResolvedPhase[]
  /** Index of the phase currently highlighted elsewhere on the tab. */
  activeIndex: number | null
  onActiveChange: (index: number | null) => void
}

/**
 * The composite plan drawn as what it actually is: one contiguous band of
 * years, split into phases. Segment width is proportional to the phase's
 * length, so a long Slow-Go stretch reads as long without reading a number.
 *
 * Presentation only — every value here is editable in the phase rows below,
 * and hovering either surface highlights the other.
 */
export default function PhaseTimeline({
  resolved,
  activeIndex,
  onActiveChange,
}: PhaseTimelineProps): React.ReactElement | null {
  if (resolved.length === 0) return null

  const start = resolved[0].fromAge
  const end = resolved[resolved.length - 1].toAge
  const span = Math.max(end - start, 0)

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-medium text-gray-700">Timeline</h3>
        <p className="font-mono text-xs tabular-nums text-gray-500">
          age {start} → {end} · {span} years
        </p>
      </div>

      <ol className="mt-3 flex items-stretch gap-1">
        {resolved.map((phase, index) => {
          const isActive = activeIndex === index
          return (
            <li
              key={`${phase.planId}-${phase.fromAge}`}
              // Proportional width, floored so a one-year phase stays readable.
              style={{ flexGrow: Math.max(phase.years, 1) }}
              className="min-w-[3.5rem] basis-0"
              onMouseEnter={() => onActiveChange(index)}
              onMouseLeave={() => onActiveChange(null)}
            >
              <p
                className={`truncate text-xs font-medium ${
                  isActive ? "text-independence-700" : "text-gray-900"
                }`}
                title={phase.planName}
              >
                {phase.planName}
              </p>
              <div
                aria-hidden="true"
                className={`mt-1.5 h-3 origin-bottom rounded-sm transition-transform duration-150 ease-out motion-reduce:transition-none ${phaseTone(
                  index,
                )} ${isActive ? "scale-y-150" : ""}`}
              />
              <p className="mt-1.5 truncate font-mono text-[11px] tabular-nums text-gray-500">
                {phase.fromAge}–{phase.toAge} · {phase.years} yr
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
