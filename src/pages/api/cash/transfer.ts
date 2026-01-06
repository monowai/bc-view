import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

interface CashTransferRequest {
  fromPortfolioId: string
  fromAssetId: string
  toPortfolioId: string
  toAssetId: string
  sentAmount: number
  receivedAmount: number
  tradeDate?: string
  description?: string
}

export default withApiAuthRequired(async function transfer(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req

    switch (method?.toUpperCase()) {
      case "POST": {
        // POST /api/cash/transfer - execute cash transfer
        const body: CashTransferRequest = req.body

        // Add today's date if not provided
        const requestBody = {
          ...body,
          tradeDate: body.tradeDate || new Date().toISOString().split("T")[0],
        }

        const url = getDataUrl("/cash/transfer")
        const response = await fetch(url, {
          ...requestInit(accessToken, "POST", req),
          body: JSON.stringify(requestBody),
        })
        await handleResponse(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["POST"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
