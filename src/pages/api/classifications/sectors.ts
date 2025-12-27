import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

interface SectorInfo {
  code: string
  name: string
  standard: string
}

interface SectorsResponse {
  data: SectorInfo[]
}

const url = getDataUrl("/classifications/sectors")

export default withApiAuthRequired(async function sectorsHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { method } = req
    const { accessToken } = await getAccessToken(req, res)

    if (method?.toUpperCase() === "GET") {
      const response = await fetch(url, requestInit(accessToken, "GET"))
      await handleResponse<SectorsResponse>(response, res)
    } else {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
