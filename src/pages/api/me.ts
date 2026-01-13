import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { NextApiRequest, NextApiResponse } from "next"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"

const baseUrl = getDataUrl()

export default withApiAuthRequired(async function me(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(`${baseUrl}/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
        })
        await handleResponse(response, res)
        break
      }
      case "PATCH": {
        const response = await fetch(`${baseUrl}/me`, {
          method: "PATCH",
          body: JSON.stringify(req.body),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
        })
        await handleResponse(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "PATCH"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
