import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { Registration } from "types/beancounter"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function register(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { method } = req
    if (method?.toUpperCase() !== "POST") {
      res.setHeader("Allow", ["POST"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const { accessToken } = await getAccessToken(req, res)
    const response = await fetch(getDataUrl("/register"), {
      ...requestInit(accessToken, "POST", req),
      body: JSON.stringify({ active: true }),
    })
    await handleResponse<Registration>(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
