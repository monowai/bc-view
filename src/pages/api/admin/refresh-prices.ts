import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/assets/price/refresh")

export default withApiAuthRequired(async function refreshPricesHandler(
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
    const response = await fetch(baseUrl, requestInit(accessToken, "POST", req))
    await handleResponse(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
