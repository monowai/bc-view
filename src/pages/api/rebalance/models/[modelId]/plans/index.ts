import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { PlansResponse, PlanResponse } from "types/rebalance"

export default withApiAuthRequired(async function modelPlans(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      method,
      query: { modelId },
    } = req
    const { accessToken } = await getAccessToken(req, res)
    const plansUrl = getRebalanceUrl(`/models/${modelId}/plans`)

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(
          plansUrl,
          requestInit(accessToken, "GET", req),
        )
        await handleResponse<PlansResponse>(response, res)
        break
      }
      case "POST": {
        const response = await fetch(plansUrl, {
          ...requestInit(accessToken, "POST", req),
          body: JSON.stringify(req.body),
        })
        await handleResponse<PlanResponse>(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "POST"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
