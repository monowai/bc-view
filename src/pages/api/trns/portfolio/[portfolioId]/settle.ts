import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

/**
 * POST /api/trns/portfolio/{portfolioId}/settle
 * Settles proposed transactions by updating their status to SETTLED.
 * Request body: { trnIds: string[] }
 */
export default withApiAuthRequired(async function settleTransactions(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req
    const { portfolioId } = req.query as { portfolioId: string }

    if (method?.toUpperCase() !== "POST") {
      res.setHeader("Allow", ["POST"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const url = getDataUrl(`/trns/portfolio/${portfolioId}/settle`)
    const response = await fetch(url, {
      ...requestInit(accessToken, "POST", req),
      body: JSON.stringify(req.body),
    })
    await handleResponse(response, res)
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
