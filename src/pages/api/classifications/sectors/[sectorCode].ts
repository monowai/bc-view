import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

interface DeleteSectorResponse {
  data: {
    sectorCode: string
    affectedAssets: number
  }
}

const baseUrl = getDataUrl("/classifications/sectors")

export default withApiAuthRequired(async function sectorHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      query: { sectorCode },
      method,
    } = req

    const { accessToken } = await getAccessToken(req, res)

    if (method?.toUpperCase() === "DELETE") {
      const url = `${baseUrl}/${sectorCode}`
      const response = await fetch(url, requestInit(accessToken, "DELETE", req))
      await handleResponse<DeleteSectorResponse>(response, res)
    } else {
      res.setHeader("Allow", ["DELETE"])
      res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
