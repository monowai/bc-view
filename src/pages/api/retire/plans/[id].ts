import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRetireUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function plan(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method, body, query } = req
    const { id } = query
    const planUrl = getRetireUrl(`/plans/${id}`)

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(planUrl, requestInit(accessToken))
        await handleResponse(response, res)
        break
      }
      case "PATCH": {
        const response = await fetch(planUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })
        await handleResponse(response, res)
        break
      }
      case "DELETE": {
        const response = await fetch(
          planUrl,
          requestInit(accessToken, "DELETE"),
        )
        await handleResponse(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "PATCH", "DELETE"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
