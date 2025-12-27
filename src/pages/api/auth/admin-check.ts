import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { NextApiRequest, NextApiResponse } from "next"

/**
 * Check if the current user has admin privileges.
 * Decodes the JWT access token to check for beancounter:admin scope.
 */
export default withApiAuthRequired(async function adminCheck(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)

    if (!accessToken) {
      return res.status(200).json({ isAdmin: false })
    }

    // Decode JWT payload (base64) to check scope
    const parts = accessToken.split(".")
    if (parts.length !== 3) {
      return res.status(200).json({ isAdmin: false })
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8"),
    )

    // Check both 'scope' (space-separated string) and 'permissions' (array)
    const scope = payload.scope || ""
    const permissions: string[] = payload.permissions || []

    const isAdmin =
      scope.includes("beancounter:admin") ||
      permissions.includes("beancounter:admin")

    return res.status(200).json({ isAdmin })
  } catch (error) {
    console.error("Admin check error:", error)
    return res.status(200).json({ isAdmin: false })
  }
})
