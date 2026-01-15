import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

/**
 * GET /api/trns/investments/monthly
 * Gets the net amount invested (BUY + ADD - SELL) for a month.
 * Query params:
 *   - yearMonth (optional): YYYY-MM format, defaults to current month
 *   - currency (optional): Target currency for FX conversion
 *   - portfolioIds (optional): Comma-separated portfolio IDs to scope
 * Returns: { yearMonth: string, totalInvested: number, currency?: string }
 */
export default withApiAuthRequired(async function monthlyInvestment(
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
    const currency = query.currency as string | undefined
    const portfolioIds = query.portfolioIds as string | undefined

    const params = new URLSearchParams()
    if (yearMonth) params.append("yearMonth", yearMonth)
    if (currency) params.append("currency", currency)
    if (portfolioIds) params.append("portfolioIds", portfolioIds)

    const queryString = params.toString()
    const url = getDataUrl(
      `/trns/investments/monthly${queryString ? `?${queryString}` : ""}`,
    )
    const response = await fetch(url, requestInit(accessToken, "GET", req))
    await handleResponse(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
