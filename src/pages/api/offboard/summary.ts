import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { OffboardingSummary } from "types/beancounter"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/offboard/summary")

/**
 * API route for offboarding summary.
 * GET: Returns counts of user's data (portfolios, assets, tax rates).
 */
export default withApiAuthRequired(async function offboardingSummary(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { method } = req
    const { accessToken } = await getAccessToken(req, res)

    if (method?.toUpperCase() !== "GET") {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const response = await fetch(baseUrl, requestInit(accessToken, "GET", req))
    await handleResponse<OffboardingSummary>(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
