import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

interface FetchPricesResponse {
  data: {
    assetId: string
    price: number
    currency: string
  }[]
}

export default withApiAuthRequired(async function planPrices(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      method,
      query: { modelId, planId },
    } = req
    const { accessToken } = await getAccessToken(req, res)
    const pricesUrl = getRebalanceUrl(
      `/models/${modelId}/plans/${planId}/prices`,
    )

    switch (method?.toUpperCase()) {
      case "GET": {
        // Fetch current market prices
        const response = await fetch(
          pricesUrl,
          requestInit(accessToken, "GET", req),
        )
        await handleResponse<FetchPricesResponse>(response, res)
        break
      }
      case "POST": {
        // Update prices
        const response = await fetch(pricesUrl, {
          ...requestInit(accessToken, "POST", req),
          body: JSON.stringify(req.body),
        })
        await handleResponse(response, res)
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
