import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { ModelsContainingAssetResponse } from "types/rebalance"

export default withApiAuthRequired(async function modelsContainingAsset(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req
    const { assetId } = req.query as { assetId: string }
    const url = getRebalanceUrl(`/assets/${assetId}/models`)

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(url, requestInit(accessToken, "GET", req))
        await handleResponse<ModelsContainingAssetResponse>(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
