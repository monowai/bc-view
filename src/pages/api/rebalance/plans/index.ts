import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { RebalancePlanDto, RebalancePlanSummaryDto } from "types/rebalance"

const baseUrl = getRebalanceUrl("/plans")

export default withApiAuthRequired(async function plans(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(
          baseUrl,
          requestInit(accessToken, "GET", req),
        )
        await handleResponse<{ data: RebalancePlanSummaryDto[] }>(response, res)
        break
      }
      case "POST": {
        console.log(`[Rebalance] Creating plan at: ${baseUrl}`)
        console.log(`[Rebalance] Request body:`, JSON.stringify(req.body))
        const response = await fetch(baseUrl, {
          ...requestInit(accessToken, "POST", req),
          body: JSON.stringify(req.body),
        })
        console.log(`[Rebalance] Response status: ${response.status}`)
        await handleResponse<RebalancePlanDto>(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "POST"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
