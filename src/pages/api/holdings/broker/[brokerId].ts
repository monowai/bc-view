import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { HoldingContract } from "types/beancounter"
import { getPositionsUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getPositionsUrl()

export default withApiAuthRequired(async function brokerHoldings(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { brokerId } = req.query
    const asAt = (req.query.asAt as string) || "today"
    const value = req.query.value !== "false"

    if (!brokerId || typeof brokerId !== "string") {
      res.status(400).json({ error: "Broker ID is required" })
      return
    }

    const url = `${baseUrl}/broker/${brokerId}?asAt=${asAt}&value=${value}`
    console.log(`GET ${url}`)

    const response = await fetch(url, requestInit(accessToken, "GET", req))

    if (!response.ok) {
      const msg = `Failed to fetch broker holdings: ${response.status}`
      console.error(msg)
      res.status(response.status).json({
        status: "error",
        message: msg,
      })
      return
    }

    await handleResponse<HoldingContract>(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
