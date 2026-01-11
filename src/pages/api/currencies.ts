import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/currencies")

export default withApiAuthRequired(async function currencies(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req

    if (method?.toUpperCase() !== "GET") {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const response = await fetch(baseUrl, requestInit(accessToken))
    await handleResponse<{ data: string[] }>(response, res)
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
