import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { ModelResponse } from "types/rebalance"

const baseUrl = getRebalanceUrl("/models")

export default withApiAuthRequired(async function modelsById(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      method,
      query: { modelId },
    } = req
    const { accessToken } = await getAccessToken(req, res)
    const byId = `${baseUrl}/${modelId}`

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(
          byId,
          requestInit(accessToken, "GET", req),
        )
        await handleResponse<ModelResponse>(response, res)
        break
      }
      case "PUT": {
        const response = await fetch(byId, {
          ...requestInit(accessToken, "PUT", req),
          body: JSON.stringify(req.body),
        })
        await handleResponse<ModelResponse>(response, res)
        break
      }
      case "DELETE": {
        const response = await fetch(
          byId,
          requestInit(accessToken, "DELETE", req),
        )
        await handleResponse<void>(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "PUT", "DELETE"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
