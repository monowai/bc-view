import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { PlanResponse } from "types/rebalance"

export default withApiAuthRequired(async function approvePlan(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { modelId, planId } = req.query
    const { accessToken } = await getAccessToken(req, res)
    const approveUrl = getRebalanceUrl(`/models/${modelId}/plans/${planId}/approve`)

    const response = await fetch(
      approveUrl,
      requestInit(accessToken, "POST", req),
    )
    return handleResponse<PlanResponse>(response, res)
  } catch (error: unknown) {
    return fetchError(res, req, error)
  }
})
