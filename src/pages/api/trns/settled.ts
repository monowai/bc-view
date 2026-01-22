import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

/**
 * GET /api/trns/settled?tradeDate=YYYY-MM-DD
 * Gets all SETTLED transactions for the current user across all portfolios
 * filtered by trade date.
 */
export default withApiAuthRequired(async function settledTransactions(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req
    const { tradeDate } = req.query as { tradeDate?: string }

    if (method?.toUpperCase() !== "GET") {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    if (!tradeDate) {
      res.status(400).json({ error: "tradeDate parameter is required" })
      return
    }

    const url = getDataUrl(`/trns/settled?tradeDate=${tradeDate}`)
    const response = await fetch(url, requestInit(accessToken, "GET", req))
    await handleResponse(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
