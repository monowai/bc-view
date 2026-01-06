import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

/**
 * GET /api/trns/portfolio/{portfolioId}/status/{status}
 * Gets transactions for a portfolio with a specific status.
 * Valid statuses: PROPOSED, CONFIRMED, SETTLED
 */
export default withApiAuthRequired(async function transactionsByStatus(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req
    const { portfolioId, status } = req.query as {
      portfolioId: string
      status: string
    }

    if (method?.toUpperCase() !== "GET") {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const url = getDataUrl(`/trns/portfolio/${portfolioId}/status/${status}`)
    const response = await fetch(url, requestInit(accessToken, "GET", req))
    await handleResponse(response, res)
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
