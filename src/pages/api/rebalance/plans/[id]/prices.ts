import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { RebalancePlanDto } from "types/rebalance"

const baseUrl = getRebalanceUrl("/plans")

export default withApiAuthRequired(async function setPlanPrices(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      method,
      query: { id },
    } = req
    const { accessToken } = await getAccessToken(req, res)

    if (method?.toUpperCase() !== "POST") {
      res.setHeader("Allow", ["POST"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const response = await fetch(`${baseUrl}/${id}/prices`, {
      ...requestInit(accessToken, "POST", req),
      body: JSON.stringify(req.body),
    })
    await handleResponse<RebalancePlanDto>(response, res)
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
