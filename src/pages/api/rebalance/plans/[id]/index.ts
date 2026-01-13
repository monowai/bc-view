import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { RebalancePlanDto } from "types/rebalance"

const baseUrl = getRebalanceUrl("/plans")

export default withApiAuthRequired(async function plansById(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      method,
      query: { id },
    } = req
    const { accessToken } = await getAccessToken(req, res)
    const byId = `${baseUrl}/${id}`

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(byId, requestInit(accessToken, "GET", req))
        await handleResponse<RebalancePlanDto>(response, res)
        break
      }
      case "PATCH": {
        const response = await fetch(byId, {
          ...requestInit(accessToken, "PATCH", req),
          body: JSON.stringify(req.body),
        })
        await handleResponse<RebalancePlanDto>(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "PATCH"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: any) {
    fetchError(req, res, error)
  }
})
