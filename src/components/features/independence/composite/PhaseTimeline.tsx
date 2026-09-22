import React from "react"
import type { CompositePhase, RetirementPlan } from "types/independence"
import MathInput from "@components/ui/MathInput"

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

/** Tone class for a phase at `index`. Shared with the drawer's marker so the
 *  open stage and its segment are visibly the same thing. */
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

const AGE_INPUT_CLASS =
  "w-14 rounded-md border border-gray-300 bg-white px-1.5 py-1 text-center font-mono text-sm tabular-nums text-gray-900 focus:border-independence-500 focus:outline-none focus:ring-1 focus:ring-independence-500"

interface PhaseTimelineProps {
  resolved: ResolvedPhase[]
  /** Index of the stage whose drawer is open, or null. */
  selectedIndex: number | null
  onSelect: (index: number | null) => void
  /**
   * A boundary moved. Boundary `i` is where stage `i` starts — and, for
   * `i ≥ 1`, where stage `i - 1` ends. See `setBoundaryAge`.
   */
  onBoundaryChange: (boundaryIndex: number, age: number) => void
  /** The drawer each segment button controls. */
  drawerId: string
}

/**
 * The composite plan drawn as what it actually is: one contiguous band of
 * years, split into stages. Segment width is proportional to the stage's
 * length, so a long Slow-Go stretch reads as long without reading a number.
 *
 * Every figure lives here exactly once. Each stage's start age sits at the
 * seam it belongs to, editable in place, and the horizon closes the band
 * on the right. Pressing a segment opens that stage's drawer beneath the
 * band, where the rest of the stage — what it is for, whose rates it runs
 * on, its place in the order — is read and changed.
 */
export default function PhaseTimeline({
  resolved,
  selectedIndex,
  onSelect,
  onBoundaryChange,
  drawerId,
}: PhaseTimelineProps): React.ReactElement | null {
  if (resolved.length === 0) return null

  return (
    <div>
      {/* The band scrolls sideways before its segments crush: each stage
          keeps room for its name and its start-age box. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <ol className="flex min-w-[22rem] items-stretch gap-1">
          {resolved.map((phase, index) => {
            const isSelected = selectedIndex === index
            const isLast = index === resolved.length - 1
            return (
              <li
                key={phase.planId}
                // Proportional width, floored so a one-year stage stays
                // readable and its age box never collides with the next.
                style={{ flexGrow: Math.max(phase.years, 1) }}
                className="flex min-w-[6rem] basis-0 flex-col"
              >
                <button
                  type="button"
                  aria-expanded={isSelected}
                  aria-controls={drawerId}
                  onClick={() => onSelect(isSelected ? null : index)}
                  className="group w-full rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-independence-500 focus-visible:ring-offset-2"
                >
                  <span className="flex items-baseline gap-1.5">
                    <span
                      className={`min-w-0 truncate text-xs font-medium ${
                        isSelected
                          ? "text-independence-700"
                          : "text-gray-900 group-hover:text-independence-700"
                      }`}
                      title={phase.planName}
                    >
                      {phase.planName}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-gray-500">
                      {phase.years} yr
                    </span>
                    <i
                      aria-hidden="true"
                      className={`fas fa-chevron-down ml-auto shrink-0 text-xs text-gray-400 transition-transform duration-150 motion-reduce:transition-none ${
                        isSelected ? "rotate-180 text-independence-600" : ""
                      }`}
                    />
                  </span>
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 block h-3 rounded-sm transition-shadow duration-150 motion-reduce:transition-none ${phaseTone(
                      index,
                    )} ${
                      isSelected
                        ? "ring-2 ring-independence-500 ring-offset-2 ring-offset-white"
                        : "group-hover:ring-2 group-hover:ring-independence-200 group-hover:ring-offset-2 group-hover:ring-offset-white"
                    }`}
                  />
                </button>

                {/* The start age sits on the seam it moves. The horizon is
                    not a seam — the projection sets it — so it is read, not
                    typed. The box is free text; `setBoundaryAge` clamps what
                    comes out of it, so no min/max is claimed here. */}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <MathInput
                    value={phase.fromAge}
                    onChange={(v) => onBoundaryChange(index, v)}
                    className={AGE_INPUT_CLASS}
                    aria-label={`${phase.planName} starts at age`}
                  />
                  {isLast && (
                    <span className="truncate font-mono text-xs tabular-nums text-gray-500">
                      to {phase.toAge}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
