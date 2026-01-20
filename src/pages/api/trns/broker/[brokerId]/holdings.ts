import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { BrokerHoldingsResponse } from "types/beancounter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function brokerHoldings(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req
    const { brokerId } = req.query

    if (!brokerId || typeof brokerId !== "string") {
      res.status(400).json({ error: "Broker ID is required" })
      return
    }

    console.log(`${method} /trns/broker/${brokerId}/holdings`)

    if (method?.toUpperCase() !== "GET") {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const response = await fetch(
      getDataUrl(`/trns/broker/${brokerId}/holdings`),
      requestInit(accessToken, "GET", req),
    )
    await handleResponse<BrokerHoldingsResponse>(response, res)
  } catch (error: any) {
    fetchError(req, res, error)
  }
})
