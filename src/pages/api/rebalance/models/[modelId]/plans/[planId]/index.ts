import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { PlanResponse } from "types/rebalance"

export default withApiAuthRequired(async function planById(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      method,
      query: { modelId, planId },
    } = req
    const { accessToken } = await getAccessToken(req, res)
    const planUrl = getRebalanceUrl(`/models/${modelId}/plans/${planId}`)

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(
          planUrl,
          requestInit(accessToken, "GET", req),
        )
        await handleResponse<PlanResponse>(response, res)
        break
      }
      case "PUT": {
        const response = await fetch(planUrl, {
          ...requestInit(accessToken, "PUT", req),
          body: JSON.stringify(req.body),
        })
        await handleResponse<PlanResponse>(response, res)
        break
      }
      case "DELETE": {
        const response = await fetch(
          planUrl,
          requestInit(accessToken, "DELETE", req),
        )
        await handleResponse<void>(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "PUT", "DELETE"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
