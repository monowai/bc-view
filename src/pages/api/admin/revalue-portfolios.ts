import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getPositionsUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function revaluePortfoliosHandler(
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

    const { force } = req.query
    const forceParam = force === "true" ? "?force=true" : ""
    const url = getPositionsUrl(`/valuations/revalue${forceParam}`)

    const { accessToken } = await getAccessToken(req, res)
    const response = await fetch(url, requestInit(accessToken, "POST", req))
    await handleResponse(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
