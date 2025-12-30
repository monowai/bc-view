import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getEventUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import * as Sentry from "@sentry/nextjs"

export default withApiAuthRequired(async function loadCorporateEvents(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  try {
    const { params } = req.query
    const { accessToken } = await getAccessToken(req, res)

    if (!params || !Array.isArray(params) || params.length < 2) {
      res.status(400).json({ error: "portfolioId and asAtDate are required" })
      return
    }

    const [portfolioId, asAtDate] = params
    const url = getEventUrl(`/load/${portfolioId}/${asAtDate}`)

    await Sentry.startSpan(
      {
        op: "http.client",
        name: `POST /load/${portfolioId}/${asAtDate}`,
        attributes: {
          "http.url": url,
          "corporate_events.portfolio_id": portfolioId,
          "corporate_events.as_at_date": asAtDate,
        },
      },
      async () => {
        console.log(`[API] Loading corporate events from: ${url}`)
        console.log(`[API] Access token present: ${!!accessToken}`)
        const response = await fetch(url, requestInit(accessToken, "POST", req))
        console.log(`[API] Response status: ${response.status}`)

        Sentry.setContext("corporate_events_load", {
          portfolioId,
          asAtDate,
          responseStatus: response.status,
        })

        if (response.status === 202 || response.status === 200) {
          const responseData = await response.json().catch(() => ({}))
          console.log(`[API] Load success response:`, responseData)
          res.status(response.status).json({ success: true, ...responseData })
        } else {
          const errorText = await response.text()
          console.error(`[API] Load failed: ${errorText}`)
          await handleResponse(response, res)
        }
      },
    )
  } catch (error: unknown) {
    Sentry.captureException(error)
    fetchError(res, req, error)
  }
})
