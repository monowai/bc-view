import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getEventUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function processEventsHandler(
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

    // Default to last 5 days if not specified
    const today = new Date()
    const fiveDaysAgo = new Date(today)
    fiveDaysAgo.setDate(today.getDate() - 5)

    const fromDate =
      (query.fromDate as string) || fiveDaysAgo.toISOString().split("T")[0]
    const toDate =
      (query.toDate as string) || today.toISOString().split("T")[0]

    const url = getEventUrl(`/events/backfill/${fromDate}/${toDate}`)

    const { accessToken } = await getAccessToken(req, res)
    const response = await fetch(url, requestInit(accessToken, "POST"))
    await handleResponse(response, res)
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
