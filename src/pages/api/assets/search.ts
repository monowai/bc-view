import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { AssetSearchResponse } from "types/beancounter"

export default withApiAuthRequired(async function searchAssets(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { keyword, market } = req.query

    if (!keyword || typeof keyword !== "string") {
      res.status(400).json({ error: "keyword parameter is required" })
      return
    }

    const params = new URLSearchParams({ keyword })
    if (market && typeof market === "string") {
      params.append("market", market)
    }

    const url = getDataUrl(`/assets/search?${params.toString()}`)
    const response = await fetch(url, requestInit(accessToken, "GET", req))
    await handleResponse<AssetSearchResponse>(response, res)
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
