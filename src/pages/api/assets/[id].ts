import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { Asset, AssetResponse } from "types/beancounter"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/assets")

export default withApiAuthRequired(async function asset(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      query: { id },
      method,
    } = req

    const { accessToken } = await getAccessToken(req, res)

    switch (method?.toUpperCase()) {
      case "GET": {
        console.log(`requesting Asset from ${baseUrl}`)
        const response = await fetch(
          `${baseUrl}/${id}`,
          requestInit(accessToken, "GET", req),
        )
        await handleResponse<Asset>(response, res)
        break
      }
      case "DELETE": {
        // Delete user-owned asset
        const url = getDataUrl(`/assets/me/${id}`)
        const response = await fetch(url, requestInit(accessToken, "DELETE", req))
        if (response.ok) {
          res.status(200).json({ success: true })
        } else {
          const errorText = await response.text()
          res.status(response.status).json({ error: errorText })
        }
        break
      }
      case "PATCH": {
        // Update user-owned asset
        const url = getDataUrl(`/assets/me/${id}`)
        const response = await fetch(url, {
          ...requestInit(accessToken, "PATCH", req),
          body: JSON.stringify(req.body),
        })
        await handleResponse<AssetResponse>(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "DELETE", "PATCH"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
