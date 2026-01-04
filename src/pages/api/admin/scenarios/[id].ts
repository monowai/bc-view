import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRetireUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function adminScenario(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method, query } = req
    const { id } = query as { id: string }
    const url = getRetireUrl(`/admin/quick-scenarios/${id}`)

    switch (method?.toUpperCase()) {
      case "PATCH": {
        const response = await fetch(
          url,
          requestInit(accessToken, "PATCH", req),
        )
        await handleResponse(response, res)
        break
      }
      case "DELETE": {
        const response = await fetch(
          url,
          requestInit(accessToken, "DELETE", req),
        )
        await handleResponse(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["PATCH", "DELETE"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
