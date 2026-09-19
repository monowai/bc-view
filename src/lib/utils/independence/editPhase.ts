/** Where the Independence plan lives. Every return target sits inside it. */
export const PLAN_SURFACE = "/independence"

/**
 * Where a journey's shared assumptions are edited.
 *
 * The wizard's per-stage Assumptions step links here when a stage inherits,
 * so the destination is spelled once rather than in every caller that wants
 * to hand the reader over — and it is built from {@link PLAN_SURFACE}, so it
 * moves with the plan surface if that ever changes.
 */
export function journeyAssumptionsHref(journeyId: string): string {
  const params = new URLSearchParams({
    view: "assumptions",
    plan: journeyId,
  })
  return `${PLAN_SURFACE}?${params.toString()}`
}

/**
 * Where a phase editor should send the user when they finish or back out.
 *
 * Editing a phase is a detour, not a destination: the reader was looking at
 * something — the plan, a spend board, a stage drill-down — and the edit is in
 * service of that. Landing them somewhere else makes them navigate back to
 * their own context, and since the plan's journey and section live in the
 * query string, "somewhere else" also loses which plan they were reading.
 *
 * The target rides in the URL, so it is attacker-controllable in principle.
 * This is an allow-list by prefix rather than a blocklist of bad shapes:
 * anything that is not demonstrably inside Independence resolves to the plan.
 */
export function resolveReturnTo(raw: string | string[] | undefined): string {
  const candidate = Array.isArray(raw) ? raw[0] : raw
  if (!candidate) return PLAN_SURFACE

  // Resolve the candidate the way the browser will before judging it. A raw
  // `startsWith` reads the string rather than the destination, and
  // "/independence/../admin" satisfies the prefix while resolving to "/admin" —
  // so the allow-list was checking the spelling of a path, not where it goes.
  // Parsing against a placeholder origin collapses `..`, `.` and their encoded
  // spellings, and makes anything absolute or protocol-relative fall out as a
  // different origin.
  let resolved: URL
  try {
    resolved = new URL(candidate, RESOLUTION_ORIGIN)
  } catch {
    return PLAN_SURFACE
  }
  if (resolved.origin !== RESOLUTION_ORIGIN) return PLAN_SURFACE

  const path = `${resolved.pathname}${resolved.search}`
  if (!path.startsWith(PLAN_SURFACE)) return PLAN_SURFACE
  // Guard the prefix boundary so "/independencelookalike" cannot pass.
  const boundary = path.charAt(PLAN_SURFACE.length)
  if (boundary && boundary !== "/" && boundary !== "?") return PLAN_SURFACE
  return path
}

/**
 * Origin used only to resolve a relative path. Never navigated to — it exists
 * so the URL parser does the normalising rather than a hand-rolled check.
 */
const RESOLUTION_ORIGIN = "http://resolve.invalid"

/**
 * Link into the phase editor, carrying where to come back to.
 *
 * Callers pass their own current path rather than naming a destination, so a
 * surface never has to know how it is reached — and the round trip preserves
 * the journey and section the caller had open.
 */
export function editPhaseHref(
  planId: string,
  returnTo: string,
  step?: string,
): string {
  const params = new URLSearchParams()
  if (step) params.set("step", step)
  params.set("returnTo", returnTo)
  return `/independence/wizard/${planId}?${params.toString()}`
}

/**
 * Names the destination, so the control says where it goes.
 *
 * Resolves first for the same reason {@link resolveReturnTo} does: the label
 * has to describe where the link lands, not how the path happens to be
 * spelled. "/independence/plans/../wizard/1" is not a stage.
 */
export function returnToLabel(target: string): string {
  return resolveReturnTo(target).startsWith(`${PLAN_SURFACE}/plans/`)
    ? "Back to this stage"
    : "Back to your plan"
}
