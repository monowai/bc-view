import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { FxResponse } from "types/beancounter"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/fx")

export default withApiAuthRequired(async function fx(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req

    if (method?.toUpperCase() !== "POST") {
      res.setHeader("Allow", ["POST"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const response = await fetch(baseUrl, {
      ...requestInit(accessToken, "POST", req),
      body: JSON.stringify(req.body),
    })
    await handleResponse<FxResponse>(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
