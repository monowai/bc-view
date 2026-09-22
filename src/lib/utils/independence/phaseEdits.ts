import type { CompositePhase } from "types/independence"

/**
 * Pure edits to a composite's phase list. The band edits ages at the seams
 * between stages, and a seam belongs to two stages at once — so every edit
 * here keeps the list contiguous rather than trusting the caller to.
 */

/** Ages a stage boundary can sit at. The band's inputs are free text. */
export const MIN_BOUNDARY_AGE = 18
export const MAX_BOUNDARY_AGE = 120

/**
 * Set the age a boundary sits at.
 *
 * Boundary 0 is where the first stage starts. Boundary `i` (i ≥ 1) is both
 * the end of stage `i - 1` and the start of stage `i`, and moving it moves
 * both — a gap or an overlap between stages is never representable.
 *
 * The age is clamped so the list stays in order with every stage at least a
 * year long: a boundary can never be dragged past its neighbours, and never
 * outside [MIN_BOUNDARY_AGE, MAX_BOUNDARY_AGE]. The input that feeds this
 * is free text, so the clamp is the only guard.
 */
export function setBoundaryAge(
  phases: CompositePhase[],
  boundaryIndex: number,
  age: number,
): CompositePhase[] {
  if (boundaryIndex < 0 || boundaryIndex >= phases.length) return phases
  if (!Number.isFinite(age)) return phases
  const previous = phases[boundaryIndex - 1]
  const next = phases[boundaryIndex + 1]
  const lo = Math.max(
    MIN_BOUNDARY_AGE,
    previous ? previous.fromAge + 1 : MIN_BOUNDARY_AGE,
  )
  const hi = Math.min(
    MAX_BOUNDARY_AGE,
    next ? next.fromAge - 1 : MAX_BOUNDARY_AGE,
  )
  const rounded = Math.min(hi, Math.max(lo, Math.round(age)))
  const updated = [...phases]
  updated[boundaryIndex] = { ...updated[boundaryIndex], fromAge: rounded }
  if (boundaryIndex > 0) {
    updated[boundaryIndex - 1] = {
      ...updated[boundaryIndex - 1],
      toAge: rounded,
    }
  }
  return updated
}

/**
 * Move a stage one place earlier or later in the timeline.
 *
 * The age windows stay where they are and the plans swap between them: the
 * years are the shape of the journey, the plans are what fills each stretch.
 * No-op at either end.
 */
export function movePhase(
  phases: CompositePhase[],
  index: number,
  direction: "earlier" | "later",
): CompositePhase[] {
  const target = direction === "earlier" ? index - 1 : index + 1
  if (index < 0 || index >= phases.length) return phases
  if (target < 0 || target >= phases.length) return phases
  const updated = [...phases]
  updated[target] = { ...updated[target], planId: phases[index].planId }
  updated[index] = { ...updated[index], planId: phases[target].planId }
  return updated
}
