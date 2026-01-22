import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

/**
 * GET /api/trns/income/monthly
 * Gets monthly income (dividends) aggregated over a rolling period.
 *
 * Query parameters:
 * - months: Number of months to include (default 12)
 * - endMonth: End month in YYYY-MM format (default current month)
 * - portfolioIds: Comma-separated portfolio IDs (optional)
 * - groupBy: "asset" or "category" (default "asset")
 */
export default withApiAuthRequired(async function monthlyIncome(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req
    const { months, endMonth, portfolioIds, groupBy } = req.query as {
      months?: string
      endMonth?: string
      portfolioIds?: string
      groupBy?: string
    }

    if (method?.toUpperCase() !== "GET") {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    // Build query string
    const params = new URLSearchParams()
    if (months) params.append("months", months)
    if (endMonth) params.append("endMonth", endMonth)
    if (portfolioIds) params.append("portfolioIds", portfolioIds)
    if (groupBy) params.append("groupBy", groupBy)

    const queryString = params.toString()
    const url = getDataUrl(
      `/trns/income/monthly${queryString ? `?${queryString}` : ""}`,
    )
    const response = await fetch(url, requestInit(accessToken, "GET", req))
    await handleResponse(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
