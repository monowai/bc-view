import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRetireUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function expenses(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method, body, query } = req
    const { id } = query
    const expensesUrl = getRetireUrl(`/plans/${id}/expenses`)

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(expensesUrl, requestInit(accessToken))
        await handleResponse(response, res)
        break
      }
      case "POST": {
        const response = await fetch(expensesUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })
        await handleResponse(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "POST"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
