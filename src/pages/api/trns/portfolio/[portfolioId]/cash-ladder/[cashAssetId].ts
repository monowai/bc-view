import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { baseUrl } from "@pages/api/trns"
import { NextApiRequest, NextApiResponse } from "next"

/**
 * API route for fetching cash ladder transactions.
 * Returns all transactions that impacted a specific cash asset.
 *
 * GET /api/trns/portfolio/{portfolioId}/cash-ladder/{cashAssetId}
 */
export default withApiAuthRequired(async function cashLadderApi(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    res.status(405).json({ error: `Method ${req.method} not allowed` })
    return
  }

  try {
    const { portfolioId, cashAssetId } = req.query

    if (!portfolioId || !cashAssetId) {
      res
        .status(400)
        .json({ error: "Portfolio ID and Cash Asset ID are required" })
      return
    }

    const { accessToken } = await getAccessToken(req, res)

    console.log(`GET cash-ladder ${portfolioId}/${cashAssetId}`)
    const url = `${baseUrl}/${portfolioId}/cash-ladder/${cashAssetId}`
    const response = await fetch(url, requestInit(accessToken, "GET", req))
    await handleResponse(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
