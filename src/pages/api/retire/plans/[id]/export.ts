import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRetireUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function exportPlan(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method, query } = req
    const { id } = query
    const exportUrl = getRetireUrl(`/plans/${id}/export`)

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(exportUrl, requestInit(accessToken))
        await handleResponse(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
