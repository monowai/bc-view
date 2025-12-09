import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { CorporateEventsResponse } from "types/beancounter"
import { getEventUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function corporateEvents(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { assetId, fromDate, toDate } = req.query
    const { accessToken } = await getAccessToken(req, res)

    if (!assetId || typeof assetId !== "string") {
      res.status(400).json({ error: "assetId is required" })
      return
    }

    let url: string
    if (fromDate && toDate) {
      url = getEventUrl(`/events/${assetId}/${fromDate}/${toDate}`)
    } else {
      url = getEventUrl(`/events/${assetId}`)
    }

    console.log(`Fetching corporate events from: ${url}`)
    const response = await fetch(url, requestInit(accessToken))
    await handleResponse<CorporateEventsResponse>(response, res)
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
