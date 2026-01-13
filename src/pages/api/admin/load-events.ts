import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getEventUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function loadEventsHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { method, query } = req

    if (method?.toUpperCase() !== "POST") {
      res.setHeader("Allow", ["POST"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    // Default to 30 days ago if not specified
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)

    const fromDate =
      (query.fromDate as string) || thirtyDaysAgo.toISOString().split("T")[0]

    const url = getEventUrl(`/load?fromDate=${fromDate}`)

    const { accessToken } = await getAccessToken(req, res)
    const response = await fetch(url, requestInit(accessToken, "POST", req))
    await handleResponse(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
