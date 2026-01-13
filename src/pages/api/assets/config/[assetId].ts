import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { PrivateAssetConfigResponse } from "types/beancounter"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/assets/config")

/**
 * API route for individual private asset config operations.
 * GET: Returns config for a specific asset.
 * POST: Creates or updates config for an asset.
 * DELETE: Removes config for an asset.
 */
export default withApiAuthRequired(async function assetConfig(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      query: { assetId },
      method,
    } = req

    const { accessToken } = await getAccessToken(req, res)
    const url = `${baseUrl}/${assetId}`

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(url, requestInit(accessToken, "GET", req))
        if (response.status === 404) {
          // Return null data for non-existent config (not an error)
          res.status(200).json({ data: null })
          return
        }
        await handleResponse<PrivateAssetConfigResponse>(response, res)
        break
      }
      case "POST": {
        const response = await fetch(url, {
          ...requestInit(accessToken, "POST", req),
          body: JSON.stringify(req.body),
        })
        await handleResponse<PrivateAssetConfigResponse>(response, res)
        break
      }
      case "DELETE": {
        const response = await fetch(
          url,
          requestInit(accessToken, "DELETE", req),
        )
        if (response.ok) {
          res.status(204).end()
        } else {
          const errorText = await response.text()
          res.status(response.status).json({ error: errorText })
        }
        break
      }
      default:
        res.setHeader("Allow", ["GET", "POST", "DELETE"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
