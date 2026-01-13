import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRetireUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getRetireUrl("/admin/quick-scenarios")

export default withApiAuthRequired(async function adminScenarios(
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
        await handleResponse(response, res)
        break
      }
      case "POST": {
        const response = await fetch(
          baseUrl,
          requestInit(accessToken, "POST", req),
        )
        await handleResponse(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "POST"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
