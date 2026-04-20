import { auth0 } from "@lib/auth0"
import { writeSystemUserId } from "@lib/auth0Management"
import { RegistrationResponse } from "types/beancounter"
import { handleErrors, hasError, fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

const SYSTEM_USER_ID_CLAIM = "https://holdsworth.app/claims/system_user_id"

/**
 * Decode the JWT payload (no verification — Auth0 SDK already verified the
 * token) and return the system_user_id claim value, or null when absent or
 * malformed. Callers compare the value against the live SystemUser.id so a
 * stale claim (e.g., SystemUser re-created or changed) still triggers a
 * metadata resync.
 */
function getSystemUserIdClaim(accessToken: string | undefined): string | null {
  if (!accessToken) return null
  try {
    const [, payload] = accessToken.split(".")
    if (!payload) return null
    // JWT segments are base64url-encoded (RFC 7515): convert to standard
    // base64 before decoding (swap chars + pad length to a multiple of 4).
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
    const decoded = JSON.parse(
      Buffer.from(padded, "base64").toString("utf8"),
    ) as Record<string, unknown>
    const claim = decoded[SYSTEM_USER_ID_CLAIM]
    return typeof claim === "string" && claim.length > 0 ? claim : null
  } catch {
    return null
  }
}

export default async function register(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  try {
    const session = await auth0.getSession(req)
    if (!session) {
      res.status(401).json({ error: "Not authenticated" })
      return
    }

    const { method } = req
    if (method?.toUpperCase() !== "POST") {
      res.setHeader("Allow", ["POST"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const { token: accessToken } = await auth0.getAccessToken(req, res)
    const response = await fetch(getDataUrl("/register"), {
      ...requestInit(accessToken, "POST", req),
      body: JSON.stringify({ active: true }),
    })

    if (hasError(response)) {
      await handleErrors(response)
      return
    }

    const registration: RegistrationResponse = await response.json()

    // Best-effort: write SystemUser.id onto the Auth0 user's app_metadata so
    // the post-login Action can emit it as a JWT claim on the next login.
    // Skip the Management API call when the current token already carries
    // the *correct* value — comparing against the live SystemUser.id so a
    // stale claim (e.g. SystemUser re-issued) still triggers a resync.
    // Failure is non-fatal — the user will hit a 401 on the next
    // ownership-gated call and re-login, triggering another attempt.
    const systemUserId = registration.data?.id
    const auth0UserId = session.user?.sub
    if (
      systemUserId &&
      auth0UserId &&
      getSystemUserIdClaim(accessToken) !== systemUserId
    ) {
      await writeSystemUserId(auth0UserId, systemUserId)
    }

    res.status(response.status || 200).json(registration)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
}
