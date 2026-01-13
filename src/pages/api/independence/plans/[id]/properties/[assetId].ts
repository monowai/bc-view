import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRetireUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function property(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method, query } = req
    const { id, assetId } = query
    const propertyUrl = getRetireUrl(`/plans/${id}/properties/${assetId}`)

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(
          propertyUrl,
          requestInit(accessToken, "GET", req),
        )
        await handleResponse(response, res)
        break
      }
      case "DELETE": {
        const response = await fetch(
          propertyUrl,
          requestInit(accessToken, "DELETE", req),
        )
        await handleResponse(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "DELETE"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: any) {
    fetchError(req, res, error)
  }
})
