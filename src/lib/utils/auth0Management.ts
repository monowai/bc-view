import { ManagementClient } from "auth0"

/**
 * Management API client for writing user metadata back to Auth0.
 *
 * Used only from server-side API routes (Next.js /pages/api/*). The credentials
 * here are M2M (client_credentials flow) against the Auth0 Management API —
 * distinct from the user-facing AUTH0_CLIENT_ID used in the login flow.
 *
 * Required env vars:
 *   - AUTH0_DOMAIN
 *   - AUTH0_MGMT_CLIENT_ID
 *   - AUTH0_MGMT_CLIENT_SECRET
 *
 * The M2M client must have `update:users_app_metadata` and `read:users`
 * granted against the Auth0 Management API.
 */

let cached: ManagementClient | null = null

function getManagementClient(): ManagementClient {
  if (cached) return cached

  const domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_MGMT_CLIENT_ID
  const clientSecret = process.env.AUTH0_MGMT_CLIENT_SECRET

  if (!domain || !clientId || !clientSecret) {
    throw new Error(
      "AUTH0_DOMAIN, AUTH0_MGMT_CLIENT_ID, AUTH0_MGMT_CLIENT_SECRET must be set",
    )
  }

  cached = new ManagementClient({ domain, clientId, clientSecret })
  return cached
}

/**
 * Write a `system_user_id` entry onto the given Auth0 user's app_metadata.
 * The Auth0 post-login Action reads this on subsequent logins and emits
 * it as the `system_user_id` JWT claim.
 *
 * Best-effort: returns true on success, false on failure. Callers should
 * treat failure as non-fatal — the user will just retry the flow next login.
 */
export async function writeSystemUserId(
  userId: string,
  systemUserId: string,
): Promise<boolean> {
  try {
    const mgmt = getManagementClient()
    await mgmt.users.update(
      userId,
      { app_metadata: { system_user_id: systemUserId } },
      // Bound the best-effort write so an Auth0 outage doesn't hold the
      // registration response open. v5 defaults to a 60s timeout with 2
      // automatic retries on 408/429/5xx; we explicitly opt out of both.
      { timeoutInSeconds: 5, maxRetries: 0 },
    )
    return true
  } catch (err) {
    // Intentionally omit userId from the log — Auth0 user_id is a stable
    // identifier; the error object carries enough context to debug.
    console.error("[auth0Management] failed to write system_user_id:", err)
    return false
  }
}
