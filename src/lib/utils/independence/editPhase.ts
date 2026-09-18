/** Where the Independence plan lives. Every return target sits inside it. */
export const PLAN_SURFACE = "/independence"

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
  // Protocol-relative ("//evil.com") is a URL the browser treats as absolute.
  if (candidate.startsWith("//")) return PLAN_SURFACE
  if (!candidate.startsWith(PLAN_SURFACE)) return PLAN_SURFACE
  // Guard the prefix boundary so "/independencelookalike" cannot pass.
  const boundary = candidate.charAt(PLAN_SURFACE.length)
  if (boundary && boundary !== "/" && boundary !== "?") return PLAN_SURFACE
  return candidate
}

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

/** Names the destination, so the control says where it goes. */
export function returnToLabel(target: string): string {
  return target.startsWith(`${PLAN_SURFACE}/plans/`)
    ? "Back to this stage"
    : "Back to your plan"
}
