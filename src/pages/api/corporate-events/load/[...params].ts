import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getEventUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

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

    console.log(`Loading corporate events from: ${url}`)
    console.log(`Access token present: ${!!accessToken}`)
    const response = await fetch(url, requestInit(accessToken, "POST", req))
    console.log(`Response status: ${response.status}`)

    if (response.status === 202 || response.status === 200) {
      // The backend returns 202 Accepted with no body for async operations
      res.status(response.status).json({ success: true })
    } else {
      await handleResponse(response, res)
    }
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
