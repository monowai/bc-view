import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { OffboardingResult } from "types/beancounter"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getRebalanceUrl("/models")

/**
 * API route for deleting user's rebalance models.
 * DELETE: Deletes all user's model portfolios and plans.
 */
export default withApiAuthRequired(async function offboardModels(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { method } = req
    const { accessToken } = await getAccessToken(req, res)

    if (method?.toUpperCase() !== "DELETE") {
      res.setHeader("Allow", ["DELETE"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const response = await fetch(
      baseUrl,
      requestInit(accessToken, "DELETE", req),
    )
    await handleResponse<OffboardingResult>(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
