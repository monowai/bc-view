import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { CorporateEventsResponse } from "types/beancounter"
import { getEventUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import * as Sentry from "@sentry/nextjs"

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
      url = getEventUrl(`/events/${assetId}?fromDate=${fromDate}&toDate=${toDate}`)
    } else {
      url = getEventUrl(`/events/${assetId}`)
    }

    await Sentry.startSpan(
      {
        op: "http.client",
        name: `GET /events/${assetId}`,
        attributes: {
          "http.url": url,
          "corporate_events.asset_id": assetId,
          "corporate_events.from_date": fromDate as string,
          "corporate_events.to_date": toDate as string,
        },
      },
      async () => {
        console.log(`Fetching corporate events from: ${url}`)
        const response = await fetch(url, requestInit(accessToken, "GET", req))

        Sentry.setContext("corporate_events_query", {
          assetId,
          fromDate,
          toDate,
          responseStatus: response.status,
        })

        await handleResponse<CorporateEventsResponse>(response, res)
      },
    )
  } catch (error: unknown) {
    Sentry.captureException(error)
    fetchError(res, req, error)
  }
})
