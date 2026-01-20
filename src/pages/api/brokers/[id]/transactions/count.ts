import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/brokers")

export default withApiAuthRequired(async function getBrokerTransactionCount(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      method,
      query: { id },
    } = req
    const { accessToken } = await getAccessToken(req, res)

    if (method?.toUpperCase() !== "GET") {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    console.log(`Get transaction count for broker ${id}`)
    const url = `${baseUrl}/${id}/transactions/count`
    const response = await fetch(url, requestInit(accessToken, "GET", req))
    await handleResponse<{ count: number }>(response, res)
  } catch (error: any) {
    fetchError(req, res, error)
  }
})
