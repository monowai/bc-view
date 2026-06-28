/**
 * Converts the just-created onboarding base plan into the default phased trio
 * (go-go / slow-go / go-slow), with go-go as the user's primary plan. New users
 * land on a phased independence plan by default. The backend converts the base
 * plan IN PLACE into the go-go, so this yields three plans, not four.
 *
 * Kept out of the wizard component so it can be unit-tested in isolation, and
 * non-fatal at the call site — the base plan stands on its own if this fails.
 *
 * Sends `force: true`: onboarding establishes the canonical phased structure for
 * a brand-new plan, so it must overwrite any stale composite left behind by a
 * prior session/offboarding (which would otherwise make the backend reject with
 * "composite already exists" and silently leave the user with a single plan).
 *
 * @param planId    the just-created base independence plan id
 * @param fetchImpl injectable for testing; defaults to global fetch
 */
export async function generatePhasedPlans(
  planId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!planId) return

  const res = await fetchImpl(`/api/independence/plans/${planId}/phases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force: true }),
  })

  if (!res.ok) {
    throw new Error(`Failed to generate phased plans: ${res.status}`)
  }
}
