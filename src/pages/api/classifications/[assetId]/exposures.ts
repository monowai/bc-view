import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

export interface SectorExposure {
  item: {
    name: string
    code: string
  }
  weight: number
  asOf: string
}

export interface ExposuresResponse {
  data: SectorExposure[]
}

const baseUrl = getDataUrl("/classifications")

export default withApiAuthRequired(async function exposuresHandler(
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
    const url = `${baseUrl}/${assetId}/exposures`
    const response = await fetch(url, requestInit(accessToken, "GET"))
    await handleResponse<ExposuresResponse>(response, res)
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
