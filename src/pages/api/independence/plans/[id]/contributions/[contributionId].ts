import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRetireUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function contribution(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method, query } = req
    const { id, contributionId } = query
    const contributionUrl = getRetireUrl(
      `/plans/${id}/contributions/${contributionId}`,
    )

    switch (method?.toUpperCase()) {
      case "DELETE": {
        const response = await fetch(
          contributionUrl,
          requestInit(accessToken, "DELETE", req),
        )
        await handleResponse(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["DELETE"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: any) {
    fetchError(req, res, error)
  }
})
