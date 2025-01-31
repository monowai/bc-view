import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/response-writer"
import { Portfolio } from "types/beancounter"
import { getDataUrl } from "@utils/api/bc-config"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/portfolios")

export default withApiAuthRequired(async function portfolios(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req
    console.log(`${method} / portfolios`)
    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(`${baseUrl}`, requestInit(accessToken))
        await handleResponse<Portfolio[]>(response, res)
        break
      }
    }
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
