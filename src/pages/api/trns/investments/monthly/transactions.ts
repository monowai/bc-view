import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

/**
 * GET /api/trns/investments/monthly/transactions
 * Gets the individual investment transactions (BUY, SELL) for a month.
 * Query params:
 *   - yearMonth (optional): YYYY-MM format, defaults to current month
 * Returns: TrnResponse with array of transactions
 */
export default withApiAuthRequired(async function monthlyInvestmentTransactions(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method, query } = req

    if (method?.toUpperCase() !== "GET") {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const yearMonth = query.yearMonth as string | undefined

    const params = new URLSearchParams()
    if (yearMonth) params.append("yearMonth", yearMonth)

    const queryString = params.toString()
    const url = getDataUrl(
      `/trns/investments/monthly/transactions${queryString ? `?${queryString}` : ""}`,
    )
    const response = await fetch(url, requestInit(accessToken, "GET", req))
    await handleResponse(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
