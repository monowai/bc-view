import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { ExecutionApiResponse } from "types/rebalance"

export default withApiAuthRequired(async function refreshExecution(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req
    const { id } = req.query as { id: string }

    if (method?.toUpperCase() !== "POST") {
      res.setHeader("Allow", ["POST"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const url = getRebalanceUrl(`/executions/${id}/refresh`)
    const response = await fetch(url, requestInit(accessToken, "POST", req))
    await handleResponse<ExecutionApiResponse>(response, res)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
