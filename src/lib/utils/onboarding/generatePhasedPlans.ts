/**
 * Converts a just-created base plan into the default phased trio
 * (go-go / slow-go / go-slow), with go-go as the user's primary plan. The
 * backend converts the base plan IN PLACE into the go-go, so this yields three
 * plans, not four.
 *
 * Kept out of the wizard components so it can be unit-tested in isolation, and
 * non-fatal at the call site — the base plan stands on its own if this fails.
 *
 * `force` controls what happens when the user already has a composite:
 * - `true` (default) — onboarding / the single-plan offer establish the
 *   canonical phased structure authoritatively, overwriting any stale composite
 *   (otherwise the backend rejects with "composite already exists" and the user
 *   is silently left with one plan).
 * - `false` — "Create Plan" for a user who may already have a real composite:
 *   the backend rejects (composite exists) and the new plan is left single
 *   rather than clobbering the existing phased setup.
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
    throw new Error(`Failed to generate phased plans: ${res.status}`)
  }
}
