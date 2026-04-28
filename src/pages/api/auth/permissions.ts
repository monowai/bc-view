import { auth0 } from "@lib/auth0"
import { NextApiRequest, NextApiResponse } from "next"

interface Permissions {
  ai: boolean
  preview: boolean
  admin: boolean
}

const NONE: Permissions = { ai: false, preview: false, admin: false }

/**
 * Decode the access token and report which Beancounter permissions the
 * caller holds. Used by the bc-view UI to gate AI surfaces (full review,
 * preview-only) without exposing the access token to the browser.
 */
export default async function permissions(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  try {
    const session = await auth0.getSession(req)
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" })
    }

    const { token: accessToken } = await auth0.getAccessToken(req, res)
    if (!accessToken) {
      return res.status(200).json(NONE)
    }

    const parts = accessToken.split(".")
    if (parts.length !== 3) {
      return res.status(200).json(NONE)
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8"),
    )

    // Split scope on whitespace so we exact-match tokens — `scope.includes`
    // would silently approve `beancounter:ai-trainer` against a check for
    // `beancounter:ai`.
    const scope: string = payload.scope || ""
    const scopes = scope.split(/\s+/).filter(Boolean)
    const permissions: string[] = payload.permissions || []
    const has = (perm: string): boolean =>
      scopes.includes(perm) || permissions.includes(perm)

    return res.status(200).json({
      ai: has("beancounter:ai"),
      preview: has("beancounter:preview"),
      admin: has("beancounter:admin"),
    })
  } catch (error) {
    console.error("Permission check error:", error)
    return res.status(200).json(NONE)
  }
}
