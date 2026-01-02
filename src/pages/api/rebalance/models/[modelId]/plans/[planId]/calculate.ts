import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { RebalanceCalculationResponse } from "types/rebalance"

export default withApiAuthRequired(async function calculateRebalance(
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
    const calculateUrl = getRebalanceUrl(`/models/${modelId}/plans/${planId}/calculate`)

    const response = await fetch(calculateUrl, {
      ...requestInit(accessToken, "POST", req),
      body: JSON.stringify(req.body),
    })
    return handleResponse<RebalanceCalculationResponse>(response, res)
  } catch (error: unknown) {
    return fetchError(res, req, error)
  }
})
