import type { CompositePhase } from "types/independence"

/**
 * Pure edits to a composite's phase list. The band edits ages at the seams
 * between stages, and a seam belongs to two stages at once — so every edit
 * here keeps the list contiguous rather than trusting the caller to.
 */

/**
 * Set the age a boundary sits at.
 *
 * Boundary 0 is where the first stage starts. Boundary `i` (i ≥ 1) is both
 * the end of stage `i - 1` and the start of stage `i`, and moving it moves
 * both — a gap or an overlap between stages is never representable.
 */
export function setBoundaryAge(
  phases: CompositePhase[],
  boundaryIndex: number,
  age: number,
): CompositePhase[] {
  if (boundaryIndex < 0 || boundaryIndex >= phases.length) return phases
  const rounded = Math.round(age)
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
