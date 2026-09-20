/**
 * Should the authenticated home page send this user straight into
 * `/onboarding`?
 *
 * `RegistrationContext` computes `isNewlyRegistered` (the `/api/register`
 * response said the SystemUser was minted today, and the browser has no
 * `bc_onboarding_complete` latch) but nothing consumed it — a fresh sign-up
 * landed on `/` and had to find the door itself.
 *
 * The rule is deliberately conservative: only a brand-new account with
 * nothing in it is redirected. A returning user is never pulled out of the
 * page they asked for, so any of these alone is a veto:
 *
 * - not newly registered — they've been here before
 * - already has a portfolio — there is something to look at
 * - onboarding marked complete — they've been through the wizard
 *
 * Pure so the branch table is testable without a router; the page effect
 * only latches and calls `router.replace`.
 */
export interface OnboardingRouteDecision {
  isNewlyRegistered: boolean
  /** Portfolios the user owns. Callers must not guess while still loading. */
  portfolioCount: number
  /** The `bc_onboarding_complete` latch, via `useRegistration`. */
  onboardingComplete: boolean
}

export function shouldRouteToOnboarding({
  isNewlyRegistered,
  portfolioCount,
  onboardingComplete,
}: OnboardingRouteDecision): boolean {
  if (!isNewlyRegistered) return false
  if (onboardingComplete) return false
  return portfolioCount === 0
}
