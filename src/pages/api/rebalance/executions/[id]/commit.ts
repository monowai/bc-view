import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRebalanceUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

interface CommitResponse {
  data: {
    transactionsCreated: number
    transactionIds: string[]
    portfolioId: string
  }
}

/**
 * POST /api/rebalance/executions/{id}/commit
 * Commits an execution by creating transactions in svc-data.
 * Request body: { portfolioId: string, transactionStatus?: "PROPOSED" | "SETTLED" }
 */
export default withApiAuthRequired(async function commitExecution(
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

    const url = getRebalanceUrl(`/executions/${id}/commit`)
    const response = await fetch(url, {
      ...requestInit(accessToken, "POST", req),
      body: JSON.stringify(req.body),
    })
    await handleResponse<CommitResponse>(response, res)
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
