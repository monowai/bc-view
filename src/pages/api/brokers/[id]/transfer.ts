import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/brokers")

export default withApiAuthRequired(async function transferBrokerTransactions(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      method,
      query: { id, toBrokerId },
    } = req
    const { accessToken } = await getAccessToken(req, res)

    if (method?.toUpperCase() !== "POST") {
      res.setHeader("Allow", ["POST"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    if (!toBrokerId || typeof toBrokerId !== "string") {
      res.status(400).json({ error: "toBrokerId is required" })
      return
    }

    console.log(`Transfer transactions from broker ${id} to ${toBrokerId}`)
    const url = `${baseUrl}/${id}/transfer?toBrokerId=${toBrokerId}`
    const response = await fetch(url, requestInit(accessToken, "POST", req))
    await handleResponse<{ transferred: number }>(response, res)
  } catch (error: any) {
    fetchError(req, res, error)
  }
})
