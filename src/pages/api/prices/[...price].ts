import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

interface PriceResponse {
  data: Array<{
    asset: {
      id: string
      code: string
      name: string
      market: { code: string }
    }
    close: number
    priceDate: string
    previousClose?: number
    change?: number
    changePercent?: number
  }>
}

/**
 * Fetch price for an asset.
 * Routes:
 *   GET /api/prices/{marketCode}/{assetCode} - Get price by market and asset code
 *   GET /api/prices/{assetId} - Get price by asset ID
 */
export default withApiAuthRequired(async function getPrice(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { price } = req.query

    if (!price || !Array.isArray(price)) {
      res.status(400).json({ error: "Invalid price path" })
      return
    }

    // Build the backend URL based on path segments
    // /api/prices/US/AAPL -> /prices/US/AAPL
    // /api/prices/{assetId} -> /prices/{assetId}
    const pricePath = price.join("/")
    const url = getDataUrl(`/prices/${pricePath}`)

    const response = await fetch(url, requestInit(accessToken, "GET", req))
    await handleResponse<PriceResponse>(response, res)
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
