import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

interface ManualClassificationResponse {
  data: {
    assetId: string
    sector?: string
    industry?: string
  }
}

const baseUrl = getDataUrl("/classifications")

export default withApiAuthRequired(async function classificationHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      query: { assetId },
      method,
    } = req

    const { accessToken } = await getAccessToken(req, res)

    switch (method?.toUpperCase()) {
      case "PUT": {
        // Set manual classification for an asset
        const url = `${baseUrl}/${assetId}`
        const response = await fetch(url, {
          ...requestInit(accessToken, "PUT", req),
          body: JSON.stringify(req.body),
        })
        await handleResponse<ManualClassificationResponse>(response, res)
        break
      }
      case "GET": {
        // Get classification for an asset
        const url = `${baseUrl}/${assetId}`
        const response = await fetch(url, requestInit(accessToken, "GET", req))
        await handleResponse<ManualClassificationResponse>(response, res)
        break
      }
      case "DELETE": {
        // Delete classification for an asset
        const url = `${baseUrl}/${assetId}`
        const response = await fetch(
          url,
          requestInit(accessToken, "DELETE", req),
        )
        if (response.ok) {
          res.status(200).json({ success: true })
        } else {
          const errorText = await response.text()
          res.status(response.status).json({ error: errorText })
        }
        break
      }
      default:
        res.setHeader("Allow", ["GET", "PUT", "DELETE"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
