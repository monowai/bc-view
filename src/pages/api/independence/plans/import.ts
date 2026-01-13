import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getRetireUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

export default withApiAuthRequired(async function importPlan(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method, body } = req
    const importUrl = getRetireUrl("/plans/import")

    switch (method?.toUpperCase()) {
      case "POST": {
        const response = await fetch(importUrl, {
          ...requestInit(accessToken, "POST", req),
          body: JSON.stringify(body),
        })
        await handleResponse(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["POST"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: any) {
    fetchError(req, res, error)
  }
})
