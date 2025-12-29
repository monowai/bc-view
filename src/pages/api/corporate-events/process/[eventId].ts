import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getEventUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function processCorporateEvent(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  try {
    const { eventId, payDate } = req.query
    const { accessToken } = await getAccessToken(req, res)

    if (!eventId || typeof eventId !== "string") {
      res.status(400).json({ error: "eventId is required" })
      return
    }

    // Build URL with optional payDate query parameter
    let url = getEventUrl(`/${eventId}`)
    if (payDate && typeof payDate === "string") {
      url += `?payDate=${payDate}`
    }

    console.log(`Processing corporate event: ${url}`)
    const response = await fetch(url, requestInit(accessToken, "POST", req))
    console.log(`Response status: ${response.status}`)

    if (response.status === 202 || response.status === 200) {
      res.status(response.status).json({ success: true })
    } else {
      await handleResponse(response, res)
    }
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
