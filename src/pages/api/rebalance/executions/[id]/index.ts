import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { ExecutionApiResponse } from "types/rebalance"

export default withApiAuthRequired(async function execution(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req
    const { id } = req.query as { id: string }
    const url = getRebalanceUrl(`/executions/${id}`)

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(url, requestInit(accessToken, "GET", req))
        await handleResponse<ExecutionApiResponse>(response, res)
        break
      }
      case "PUT": {
        const response = await fetch(url, {
          ...requestInit(accessToken, "PUT", req),
          body: JSON.stringify(req.body),
        })
        await handleResponse<ExecutionApiResponse>(response, res)
        break
      }
      case "DELETE": {
        const response = await fetch(
          url,
          requestInit(accessToken, "DELETE", req),
        )
        if (response.ok) {
          res.status(204).end()
        } else {
          await handleResponse(response, res)
        }
        break
      }
      default:
        res.setHeader("Allow", ["GET", "PUT", "DELETE"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
