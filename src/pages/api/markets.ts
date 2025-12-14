import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { Market } from "types/beancounter"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/markets")

export default withApiAuthRequired(async function markets(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log(`requesting markets from ${baseUrl}`)
  try {
    const { accessToken } = await getAccessToken(req, res)

    const response = await fetch(`${baseUrl}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    await handleResponse<Market[]>(response, res)
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
