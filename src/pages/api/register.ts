import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { Registration } from "types/beancounter"
import handleResponse, { fetchError } from "@lib/api/responseWriter"
import { getDataUrl } from "@lib/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl()

export default withApiAuthRequired(async function currencies(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log(`Registering user @ \`${baseUrl}/register`)
  try {
    const { accessToken } = await getAccessToken(req, res)
    const response = await fetch(`${baseUrl}/register`, {
      method: "POST",
      body: JSON.stringify({ active: true }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
    })
    await handleResponse<Registration>(response, res)
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
