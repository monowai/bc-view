import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { AssetResponse } from "types/beancounter"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

/**
 * Resolves an asset by market and code.
 * Creates the asset in svc-data if it doesn't exist.
 * Returns the asset with its real UUID.
 *
 * GET /api/assets/resolve?market=US&code=VOO
 */
export default withApiAuthRequired(async function resolveAsset(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    let { market, code } = req.query

    if (!code || typeof code !== "string") {
      res.status(400).json({ error: "code parameter is required" })
      return
    }

    // If code contains ":", it's already in MARKET:CODE format
    if (code.includes(":")) {
      const parts = code.split(":")
      market = parts[0]
      code = parts[1]
    }

    // Default to US market if not specified
    if (!market || typeof market !== "string") {
      market = "US"
    }

    // Call svc-data to get/create the asset
    const url = getDataUrl(`/assets/${market}/${code}`)
    const response = await fetch(url, requestInit(accessToken, "GET", req))
    await handleResponse<AssetResponse>(response, res)
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
