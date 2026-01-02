import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { ModelResponse, ModelsResponse } from "types/rebalance"

const baseUrl = getRebalanceUrl("/models")

export default withApiAuthRequired(async function models(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(
          baseUrl,
          requestInit(accessToken, "GET", req),
        )
        await handleResponse<ModelsResponse>(response, res)
        break
      }
      case "POST": {
        const response = await fetch(baseUrl, {
          ...requestInit(accessToken, "POST", req),
          body: JSON.stringify(req.body),
        })
        await handleResponse<ModelResponse>(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "POST"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
