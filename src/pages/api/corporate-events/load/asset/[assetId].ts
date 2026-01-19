import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getEventUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import * as Sentry from "@sentry/nextjs"

export default withApiAuthRequired(async function loadAssetEvents(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  try {
    const { assetId, asAt } = req.query
    const { accessToken } = await getAccessToken(req, res)

    if (!assetId || typeof assetId !== "string") {
      res.status(400).json({ error: "assetId is required" })
      return
    }

    const dateParam = asAt ? `?asAt=${asAt}` : ""
    const url = getEventUrl(`/load/asset/${assetId}${dateParam}`)

    await Sentry.startSpan(
      {
        op: "http.client",
        name: `POST /load/asset/${assetId}`,
        attributes: {
          "http.url": url,
          "corporate_events.asset_id": assetId,
          "corporate_events.as_at_date": asAt as string,
        },
      },
      async () => {
        console.log(`[API] Loading corporate events for asset: ${url}`)
        const response = await fetch(url, requestInit(accessToken, "POST", req))
        console.log(`[API] Response status: ${response.status}`)

        Sentry.setContext("corporate_events_load_asset", {
          assetId,
          asAt,
          responseStatus: response.status,
        })

        if (response.ok) {
          const responseData = await response.json()
          console.log(
            `[API] Load asset events success, count: ${responseData?.data?.length || 0}`,
          )
          res.status(200).json(responseData)
        } else {
          const errorText = await response.text()
          console.error(`[API] Load asset events failed: ${errorText}`)
          await handleResponse(response, res)
        }
      },
    )
  } catch (error: unknown) {
    Sentry.captureException(error)
    fetchError(req, res, error)
  }
})
