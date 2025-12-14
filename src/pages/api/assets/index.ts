import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { AssetResponse } from "types/beancounter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/assets")

export default withApiAuthRequired(async function assets(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method, query } = req

    switch (method?.toUpperCase()) {
      case "GET": {
        // GET /api/assets - fetch all user's custom assets
        // GET /api/assets?category=ACCOUNT - fetch user's assets by category
        const category = query.category as string
        const url = category
          ? getDataUrl(`/assets/me/${category}`)
          : getDataUrl("/assets/me")
        const response = await fetch(url, requestInit(accessToken, "GET"))
        await handleResponse<AssetResponse>(response, res)
        break
      }
      case "POST": {
        console.log("POST /assets - creating asset")
        const response = await fetch(baseUrl, {
          ...requestInit(accessToken, "POST"),
          body: JSON.stringify(req.body),
        })
        await handleResponse<AssetResponse>(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "POST"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
