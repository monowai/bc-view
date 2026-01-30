import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRetireUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function financials(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method, query } = req
    const { id: planId } = query

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(
          getRetireUrl(`/projection/plans/${planId}/financials`),
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          },
        )
        await handleResponse(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: any) {
    fetchError(req, res, error)
  }
})
