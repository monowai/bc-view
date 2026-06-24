/**
 * Full-page redirect into the Auth0 logout flow. Extracted into its own module
 * so the offboarding force-logout can be mocked in tests — jsdom locks
 * window.location and its methods against redefinition.
 */
export function forceLogout(): void {
  window.location.assign("/auth/logout")
}
