import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

interface WeightsFromHoldingsResponse {
  data: Array<{
    assetId: string
    assetCode: string
    assetName: string | null
    marketCode: string | null
    weight: number
    marketValue: number
    price: number
    priceCurrency: string
  }>
}

export default withApiAuthRequired(async function weightsFromHoldings(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const {
      query: { modelId, portfolioId, valueCurrency },
    } = req

    const url = getRebalanceUrl(
      `/models/${modelId}/plans/weights-from-holdings?portfolioId=${portfolioId}&valueCurrency=${valueCurrency || "USD"}`,
    )

    const response = await fetch(url, requestInit(accessToken, "GET", req))
    await handleResponse<WeightsFromHoldingsResponse>(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
