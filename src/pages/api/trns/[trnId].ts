import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { Transaction } from "types/beancounter"
import { requestInit } from "@utils/api/fetchHelper"
import { baseUrl } from "@pages/api/trns"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function trnApi(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { trnId, portfolioId } = req.query
    const { accessToken } = await getAccessToken(req, res)

    if (!trnId) {
      res.status(400).json({ error: "Transaction ID required" })
      return
    }

    if (req.method === "GET") {
      console.log(`GET trn ${trnId}`)
      const response = await fetch(
        `${baseUrl}/${trnId}`,
        requestInit(accessToken, "GET", req),
      )
      await handleResponse<Transaction>(response, res)
    } else if (req.method === "PATCH") {
      if (!portfolioId) {
        res.status(400).json({ error: "Portfolio ID required for PATCH" })
        return
      }
      console.log(`PATCH trn ${portfolioId}/${trnId}`)
      const response = await fetch(`${baseUrl}/${portfolioId}/${trnId}`, {
        ...requestInit(accessToken, "PATCH", req),
        body: JSON.stringify(req.body),
      })
      await handleResponse<Transaction>(response, res)
    } else if (req.method === "DELETE") {
      console.log(`DELETE trn ${trnId}`)
      const response = await fetch(
        `${baseUrl}/${trnId}`,
        requestInit(accessToken, "DELETE", req),
      )
      await handleResponse<Transaction>(response, res)
    } else {
      res.setHeader("Allow", ["GET", "PATCH", "DELETE"])
      res.status(405).json({ error: `Method ${req.method} not allowed` })
    }
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
