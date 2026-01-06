import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { PrivateAssetConfigsResponse } from "types/beancounter"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/assets/config")

/**
 * API route for private asset configs.
 * GET: Returns all configs for the current user's assets.
 */
export default withApiAuthRequired(async function assetConfigs(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { method } = req
    const { accessToken } = await getAccessToken(req, res)

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(
          baseUrl,
          requestInit(accessToken, "GET", req),
        )
        await handleResponse<PrivateAssetConfigsResponse>(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
