import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { Broker } from "types/beancounter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/brokers")

export default withApiAuthRequired(async function brokers(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req
    console.log(`${method} /brokers`)
    switch (method?.toUpperCase()) {
      case "GET": {
        // Forward query params (e.g., includeAccounts=true)
        const queryString = req.url?.split("?")[1] || ""
        const url = queryString ? `${baseUrl}?${queryString}` : baseUrl
        const response = await fetch(url, requestInit(accessToken, "GET", req))
        await handleResponse<Broker[]>(response, res)
        break
      }
      case "POST": {
        const response = await fetch(`${baseUrl}`, {
          ...requestInit(accessToken, "POST", req),
          body: JSON.stringify(req.body),
        })
        await handleResponse<Broker>(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "POST"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: any) {
    fetchError(req, res, error)
  }
})
