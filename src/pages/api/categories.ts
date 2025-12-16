import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { AssetCategory } from "types/beancounter"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/assets/categories")

export default withApiAuthRequired(async function categories(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)

    const response = await fetch(`${baseUrl}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    await handleResponse<AssetCategory[]>(response, res)
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
