import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { Currency } from "types/beancounter"
import handleResponse, { fetchError } from "@lib/api/responseWriter"
import { getDataUrl } from "@lib/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/currencies")

export default withApiAuthRequired(async function currencies(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log(`requesting currencies from ${baseUrl}`)
  try {
    const { accessToken } = await getAccessToken(req, res)

    const response = await fetch(`${baseUrl}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    await handleResponse<Currency[]>(response, res)
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
