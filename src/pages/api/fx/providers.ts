import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { FxProvidersResponse } from "types/beancounter"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/fx/providers")

export default withApiAuthRequired(async function fxProviders(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req

    if (method?.toUpperCase() !== "GET") {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const response = await fetch(baseUrl, requestInit(accessToken, "GET", req))
    await handleResponse<FxProvidersResponse>(response, res)
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
