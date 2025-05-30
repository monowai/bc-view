import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import handleResponse, { fetchError } from "@utils/api/response-writer"
import { Transaction } from "types/beancounter"
import { requestInit } from "@utils/api/fetchHelper"
import { baseUrl } from "@pages/api/trns"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function tradeTrns(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { trades } = req.query
    const { method } = req
    const { accessToken } = await getAccessToken(req, res)
    if (trades) {
      console.log(`${method} trades for ${trades[0]} / ${trades[1]}`)
      switch (method) {
        case "GET": {
          const response = await fetch(
            `${baseUrl}/${trades[0]}/asset/${trades[1]}/trades`,
            requestInit(accessToken),
          )
          await handleResponse<Transaction[]>(response, res)
          break
        }
        case "DELETE": {
          console.log(`Delete trnId: ${trades[0]}`)
          const response = await fetch(
            `${baseUrl}/${trades[0]}`,
            requestInit(accessToken, "DELETE"),
          )
          await handleResponse(response, res)
          break
        }
      }
    }
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
