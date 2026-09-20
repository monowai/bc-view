/**
 * Converts a just-created base plan into the default phased trio
 * (go-go / slow-go / no-go), with go-go as the user's primary plan. The
 * backend converts the base plan IN PLACE into the go-go, so this yields three
 * plans, not four.
 *
 * Kept out of the wizard components so it can be unit-tested in isolation, and
 * non-fatal at the call site — the base plan stands on its own if this fails.
 *
 * `force` controls what happens when the user already has a composite:
 * - `true` (default) — onboarding establishes the canonical phased structure
 *   for a brand-new user authoritatively, overwriting any stale composite
 *   (otherwise the backend rejects with "composite already exists" and the user
 *   is silently left with one plan). The phasing offer on /independence does
 *   not come through here: it names its journey and never forces, so a tuned
 *   composite on another journey cannot be clobbered.
 * - `false` — "Create Plan" for a user who may already have a real composite:
 *   the backend rejects (composite exists) and the new plan is left single
 *   rather than clobbering the existing phased setup.
 *
 * A refusal carries a reason the user can act on — svc-retire answers "Set a
 * target independence age or year of birth before generating phases" when the
 * profile has neither. The thrown Error therefore carries the backend's own
 * words whenever the response has any, so a call site can put them on screen
 * unedited; the status-only message is the fallback for a body that says
 * nothing.
 *
 * @param planId    the just-created base independence plan id
 * @param force     overwrite an existing composite (default true)
 * @param fetchImpl injectable for testing; defaults to global fetch
 */
export async function generatePhasedPlans(
  planId: string,
  force = true,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!planId) return

  const res = await fetchImpl(`/api/independence/plans/${planId}/phases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  })

  if (!res.ok) {
    const detail = await phaseFailureDetail(res)
    throw new Error(detail || `Failed to generate phased plans: ${res.status}`)
  }
}

/**
 * The BFF forwards a backend rejection as `{ error, message, code }` (see
 * responseWriter), so prefer `message`, fall back to `error`, then to the raw
 * body. Returns "" when there is nothing quotable, leaving the caller on the
 * status-only message.
 */
async function phaseFailureDetail(res: Response): Promise<string> {
  if (typeof res.text !== "function") return ""
  const body = (await res.text().catch(() => "")).trim()
  if (!body) return ""
  try {
    const parsed: unknown = JSON.parse(body)
    if (parsed && typeof parsed === "object") {
      const { message, error } = parsed as { message?: string; error?: string }
      const detail = message?.trim() || error?.trim()
      if (detail) return detail
    }
  } catch {
    // Not JSON — the raw body is the best answer available.
  }
  return body
}
