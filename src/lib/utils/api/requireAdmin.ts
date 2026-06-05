import { auth0 } from "@lib/auth0"
import { NextApiRequest, NextApiResponse } from "next"

interface AdminGuardResult {
  ok: boolean
  token?: string
}

/**
 * Server-side admin gate for sensitive API routes. Verifies an Auth0
 * session exists and the access token carries the
 * `beancounter:admin` permission (in either the `scope` claim or the
 * `permissions` array — Auth0 RBAC emits both depending on API
 * settings). Writes 401 / 403 on the response and returns
 * `{ ok: false }` when the caller should not proceed.
 *
 * The client-side `usePermissions().admin` flag hides admin pages from the UI;
 * this exists so direct calls to `/api/admin/*` are also blocked.
 */
export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<AdminGuardResult> {
  const session = await auth0.getSession(req)
  if (!session) {
    res.status(401).json({ error: "Not authenticated" })
    return { ok: false }
  }

  const { token } = await auth0.getAccessToken(req, res)
  if (!token) {
    res.status(401).json({ error: "Unauthorized" })
    return { ok: false }
  }

  const parts = token.split(".")
  if (parts.length !== 3) {
    res.status(403).json({ error: "Forbidden" })
    return { ok: false }
  }

  let payload: { scope?: string; permissions?: string[] }
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"))
  } catch {
    res.status(403).json({ error: "Forbidden" })
    return { ok: false }
  }

  const scope = payload.scope ?? ""
  const permissions = payload.permissions ?? []
  const isAdmin =
    scope.split(" ").includes("beancounter:admin") ||
    permissions.includes("beancounter:admin")

  if (!isAdmin) {
    res.status(403).json({ error: "Forbidden" })
    return { ok: false }
  }

  return { ok: true, token }
}
