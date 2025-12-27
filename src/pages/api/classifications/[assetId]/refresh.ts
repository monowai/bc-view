import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

interface RefreshResponse {
  assetId: string
  refreshed: boolean
}

const baseUrl = getDataUrl("/classifications")

export default withApiAuthRequired(async function refreshHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      query: { assetId },
      method,
    } = req

    if (method?.toUpperCase() !== "POST") {
      res.setHeader("Allow", ["POST"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const { accessToken } = await getAccessToken(req, res)
    const url = `${baseUrl}/refresh/${assetId}`
    const response = await fetch(url, requestInit(accessToken, "POST"))
    await handleResponse<RefreshResponse>(response, res)
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
