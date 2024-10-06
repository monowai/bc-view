import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { Asset } from "@components/types/beancounter"
import handleResponse, { fetchError } from "@utils/api/response-writer"
import { getDataUrl } from "@utils/api/bc-config"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/assets")

export default withApiAuthRequired(async function asset(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log(`requesting Asset from ${baseUrl}`)
  try {
    const {
      query: { id },
    } = req

    const { accessToken } = await getAccessToken(req, res)

    const response = await fetch(`${baseUrl}/${id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    await handleResponse<Asset>(response, res)
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
