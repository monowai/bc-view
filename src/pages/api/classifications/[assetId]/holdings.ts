import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

export interface AssetHolding {
  symbol: string
  name?: string
  weight: number
  asOf: string
}

export interface HoldingsResponse {
  data: AssetHolding[]
}

const baseUrl = getDataUrl("/classifications")

export default withApiAuthRequired(async function holdingsHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      query: { assetId },
      method,
    } = req

    if (method?.toUpperCase() !== "GET") {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const { accessToken } = await getAccessToken(req, res)
    const url = `${baseUrl}/${assetId}/holdings`
    const response = await fetch(url, requestInit(accessToken, "GET", req))
    await handleResponse<HoldingsResponse>(response, res)
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
