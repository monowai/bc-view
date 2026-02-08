import { auth0 } from "@lib/auth0"
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
export default async function assetConfig(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  try {
    const session = await auth0.getSession(req)
    if (!session) {
      res.status(401).json({ error: "Not authenticated" })
      return
    }

    const {
      query: { assetId },
      method,
    } = req

    const { token: accessToken } = await auth0.getAccessToken(req, res)
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
}
